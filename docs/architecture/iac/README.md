# IaC outline: plain AWS CloudFormation (YAML)
Status: **skeleton only, never deployed.** Tool: [ADR-0010](../adr/0010-iac-cloudformation.md) (supersedes the CDK choice in ADR-0001).
Single AWS account, us-east-1. Environments are separated by stack name `SentinelQA-<env>-<stack>` and the `EnvName` parameter (D-08).

## Profiles
`EnvProfile` parameter (`lean` for dev/stage, `strict` for prod; [ADR-0013](../adr/0013-environment-profiles.md)). Condition `IsStrict` controls: SSE (strict = AWS managed key `aws/dynamodb`, lean = AWS owned key), PITR, deletion protection (20), log retention 7/30 d (O-02), X-Ray (30), extra alarms (50). **No customer-managed KMS keys anywhere (O-09).** `25-backup` is deployed for prod only. Set in [params/](params/).

## Templates (deploy order: 00 → 10 → 20 → 30 → 40 → 50, then 25 for prod only)
Import graph: 25←{00,10,20}, 30←{00,20}, 40←30, 50←{10,30}. No cycles. Delete in reverse order.

| # | Template | Stack name | Resources | Notes |
|---|---|---|---|---|
| 00 | [00-bootstrap.yaml](templates/00-bootstrap.yaml) (**InfraDeploy**) | `SentinelQA-<env>-Bootstrap` | OIDC deploy role, CFN execution role, app-role permissions boundary, artifact bucket | Exports `AppRoleBoundaryArn`, `ArtifactBucketName`, `CfnExecRoleArn` |
| 10 | [10-security.yaml](templates/10-security.yaml) | `SentinelQA-<env>-Security` | SNS email topic (`alias/aws/sns`) | `AlarmEmail` AllowedPattern, no default; supplied from `vars.ALARM_EMAIL` (see below). CloudTrail/Budgets TODO (account-level) |
| 20 | [20-data.yaml](templates/20-data.yaml) | `SentinelQA-<env>-Data` | `Domain` (sparse GSI1 review queue, sparse GSI2 on `dueAt`, sparse GSI3 on `needByAt`), `AuditLog`. Prod: PITR, `aws/dynamodb`, deletion protection, Retain, no TTL. SSM: PLACEHOLDER BR-47 defaults, keyword markers (whole-word, case-insensitive) + structured CFR ranges `cfr-ranges` | No stream / Object Lock (D-05) |
| 30 | [30-api.yaml](templates/30-api.yaml) | `SentinelQA-<env>-Api` | HTTP API with **67 explicit routes generated from [../api/openapi.yaml](../api/openapi.yaml)** by [tools/gen-routes.py](tools/gen-routes.py), `records-api`/`reports-api` (nodejs24.x, arm64, code at `<sha>/<fn>.zip`), boundary-scoped roles (AuditLog put + read, explicit Update/Delete deny on both tables), log groups 7/90 d | No `/api/ai/*`, no `/api/search`, no catch-all |
| 40 | [40-web.yaml](templates/40-web.yaml) | `SentinelQA-<env>-Web` | S3 + OAC, CloudFront (`/api/*` → API with `X-Origin-Verify`, ADR-0015) | `OriginVerifySecret` NoEcho, supplied by the pipeline. WAF slot empty |
| 50 | [50-observability.yaml](templates/50-observability.yaml) | `SentinelQA-<env>-Observability` | Lean: records-api errors. Strict: + API 5xx, Domain/AuditLog SystemErrors (per-operation metric math), gate blocks (EMF `SentinelQA`/`ControlledDataBlocked`/`Env`) | |
| 25 | [25-backup.yaml](templates/25-backup.yaml) | `SentinelQA-prod-Backup` (**prod only, last**) | Export bucket (→ Glacier, 7 y), export Lambda, monthly export + daily verify schedules, export-errors alarm, `ExportHealthy` heartbeat alarm (missing = breaching, 3 days) | Requires PITR (20, strict) |

## Parameters changed in v0.5 (InfraDeploy to apply in `params/*.json`)
- `30-api` and `25-backup`: **remove `ArtifactBucket`** (now imported). `RecordsApiKey`/`ReportsApiKey`/`ExportFnKey` must match `<sha>/<fn>.zip` (pipeline-supplied).
- `40-web`: **new `OriginVerifySecret`** (NoEcho). The pipeline reads it from SSM `/sentinelqa/<env>/edge/origin-verify`. Never put it in params files.

## Prod stack protection
- `aws cloudformation update-termination-protection --enable-termination-protection --stack-name SentinelQA-prod-<Stack>` for every prod stack (a stack setting, not a template property).
- Stack policy on `SentinelQA-prod-Data` and `SentinelQA-prod-Backup`:
```json
{"Statement":[
 {"Effect":"Allow","Principal":"*","Action":"Update:*","Resource":"*"},
 {"Effect":"Deny","Principal":"*","Action":["Update:Replace","Update:Delete"],"Resource":["LogicalResourceId/DomainTable","LogicalResourceId/AuditLogTable","LogicalResourceId/ExportBucket"]}]}
```
- Change sets for prod use `RollbackConfiguration` with the API 5xx and records-errors alarms as triggers.

## Validation performed
- `cfn-lint` 1.57.2 (offline): **all 8 templates (incl. InfraDeploy 00-account-oidc) pass with no errors or warnings** (2026-10-13, v0.5 rerun).
- OpenAPI spec validates with `openapi-spec-validator` (3.1).
- `aws cloudformation validate-template`: not run (no session; it would be read-only).

## Resource tagging (ADR-0017)
Every `aws cloudformation deploy` passes stack-level tags, for example:

```bash
aws cloudformation deploy --stack-name SentinelQA-$ENV-Bootstrap --template-file templates/00-bootstrap.yaml \
  --parameter-overrides EnvName=$ENV GitHubRepo=vishwasvr/SentinelQA --capabilities CAPABILITY_NAMED_IAM \
  --tags Project=SentinelQA Environment="$ENV" ManagedBy=CloudFormation Repo=vishwasvr/SentinelQA --no-execute-changeset
```

Use `Environment=shared` for account-wide stacks (`SentinelQA-Account-OIDC`). 00-bootstrap and 00-account-oidc also declare the four tags explicitly on every taggable resource (the bucket, both roles, the OIDC provider); `AWS::IAM::ManagedPolicy` (app boundary) has no `Tags` property in CloudFormation. The legacy `app`/`env` keys are removed. Already-deployed stacks keep their old `app`/`env` tags until a Vishwas-approved redeploy, which is a tag-only update with no replacement.

## Deploy flow (documented, not executed)
GitHub Actions (OIDC) → `cfn-lint` + `gen-routes.py` drift check → esbuild bundle and upload `<sha>/<fn>.zip` ([ADR-0014](../adr/0014-build-packaging.md)) → `create-change-set` (CFN execution role) → manual approval (prod reviewer) → `execute-change-set`. No deploy has been performed from this repo.

## Deferred / removed vs v0.1
Removed: customer-managed KMS keys (O-09), CDK skeleton, Bedrock/Guardrails, AgentTask table, `ai-gateway`, `audit-archiver`, S3 Object Lock, WAF.

## AlarmEmail contract (deploy time)

`AlarmEmail` (10-security) is **not** stored in `params/*.json`; the params validator (`npm run params-schema`, `ci/params.schema.json` + `scripts/ci/params-schema.mjs`) rejects an `AlarmEmail` key and any value that looks like an email address.

- Each GitHub environment (`dev`, `stage`, `prod`) has an environment **variable** `ALARM_EMAIL` (not a secret; set by Chief of Staff after Vishwas approves).
- The deploy job runs with `environment: <env>` and passes it as a parameter override, e.g. `--parameter-overrides EnvName=<env> AlarmEmail=${{ vars.ALARM_EMAIL }}` (or `ParameterKey=AlarmEmail,ParameterValue=${{ vars.ALARM_EMAIL }}`). The job fails if the variable is empty.
- The template keeps `AlarmEmail` as a required parameter with an `AllowedPattern` and **no default**.
- Manual (admin) runs read it with `gh variable get ALARM_EMAIL --env <env> --repo vishwasvr/SentinelQA`.

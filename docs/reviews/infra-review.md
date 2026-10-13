# Infrastructure & deployment review (pre-first-deploy)
- Date: 2026-10-13 · Reviewer: InfraDeploy (offline review; nothing deployed, no AWS credentials used)
- Scope: BRD v1.2.2 §12, architecture-overview §14, ADR-0009/0012/0013, cost-estimate.md, `docs/architecture/iac/templates/*` (7 stacks) and `iac/params/{dev,stage,prod}.json`.
- Offline validation: `cfn-lint 1.57.2` on all 7 templates → **0 errors, 0 warnings** (matches iac/README.md). Lint does not catch the semantic issues below.

Paths below are relative to `docs/architecture/iac/` unless stated.

## Summary
| # | Severity | Owner | Finding |
|---|---|---|---|
| B-1 | blocker | InfraDeploy | ~~Deploy role cannot actually deploy anything (no CFN service role, no resource perms)~~ **Fixed in 3c6dbdf** |
| B-2 | blocker | InfraDeploy | ~~Lambda artifact bucket is referenced but never created; deploy role cannot upload to it~~ **Fixed in 3c6dbdf** (30-api/25-backup still to import `SentinelQA-<env>-ArtifactBucketName`) |
| B-3 | blocker | Vishwas | All param files have `TODO` values (repo, OIDC ARN, alarm email, artifact keys) — **Partially resolved (commit below)**: params filled (account 723940054516, repo, OIDC ARN [existence unverified], alarm email, artifact buckets; code keys pipeline-supplied). Still pending: Lambda code (B-4, Developer). AlarmEmail pattern done (1c15d5c); ArtifactBucket now imported; OriginVerifySecret supplied by the pipeline from SSM |
| B-4 | blocker | Developer | Lambda code (`records-api`, `reports-api`, `ddb-export`) doesn't exist; stacks 30/25 can't be created without zips |
| M-1 | major | InfraDeploy | Prod alarm `ApiServerErrors` uses literal `TODO-ApiId`, so it never fires |
| M-2 | major | InfraDeploy | `AuditUserErrors` alarm uses a `TableName` dimension DynamoDB doesn't publish for `UserErrors`, so it never fires |
| M-3 | major | Developer | `GateBlocks` alarm depends on a custom metric nothing emits yet |
| M-4 | major | Architect | Backup job: only Lambda `Errors` is alarmed. Async export FAILED, or a skipped run, raises no alert |
| M-5 | major | InfraDeploy | No prod rollback/safety controls: stack policy, termination protection, rollback triggers |
| M-6 | major | InfraDeploy | Deploy order in README table is wrong (25 is listed before 20, which it imports) |
| M-7 | major | Architect | ~~Lean tables are `Retain` with fixed names, so a dev/stage stack delete/recreate collides (BR-46 resets)~~ **Resolved by runbook** [nonprod-table-reset.md](../runbooks/nonprod-table-reset.md) (option b), 3c6dbdf |
| M-8 | major | InfraDeploy | No drift detection; no CloudTrail; no Budget (all TODO) |
| m-1 | minor | InfraDeploy | Tagging is inconsistent: only `env` on some resources, none on roles/Lambdas/API/CloudFront/SNS/alarms |
| m-2 | minor | InfraDeploy | Param file format is not consumable by the CLI as-is; 25-backup duplicates `ArtifactBucket` |
| m-3 | minor | InfraDeploy | OIDC trust: env scoping is only as strong as GitHub environment protection rules; no `job_workflow_ref` pin |
| m-4 | minor | InfraDeploy | Cross-stack export coupling (`ApiDomain`, `RecordsFnName`) blocks replacement updates of 30-api |
| m-5 | minor | Developer | 40-web: no SPA error-response fallback, no security response headers, no access logs |
| m-6 | minor | Developer | 30-api: no HTTP API access logging; Reports Lambda has no tracing/memory setting; no reserved concurrency |
| m-7 | minor | Architect | Backup stays in the same account/region (single blast radius, O-03) |
| m-8 | minor | Tester | No post-deploy smoke tests / export test are defined in the pipeline |
| DEV-16 | design | InfraDeploy/Architect | **Open**: ephemeral `dev-<name>` envs (see Fix status) |
| m-9 | minor | BusinessAnalyst | BR-46 dev/stage "admin table reset" has no defined mechanism/role (mechanism defined in runbook, 3c6dbdf; reset role not yet templated) |
| D-19 | minor | InfraDeploy | ~~Deploy role can modify its own Bootstrap stack and pass its own role (developer-review #19)~~ **Fixed in 3c6dbdf**: explicit Deny on `stack/SentinelQA-<env>-Bootstrap/*`, PassRole only on `SentinelQA-<env>-cfn-exec` (`iam:PassedToService` = CloudFormation), Deny on PassRole/modify of the deploy role itself |

## Fix status (2026-10-13)
- **B-1 fixed (3c6dbdf)**: `SentinelQA-<env>-cfn-exec` service role (trust: `cloudformation.amazonaws.com`, SourceArn limited to `SentinelQA-<env>-*` stacks) with resource-scoped permissions for IAM, DynamoDB, Lambda, API Gateway v2, S3, CloudFront, SNS, CloudWatch, Logs, Scheduler and SSM (`/sentinelqa/<env>/*`). It may create or modify IAM roles only when they carry the new `SentinelQA-<env>-app-boundary` managed policy. The deploy role must pass the exec role (`cloudformation:RoleArn` deny condition). Added ListChangeSets/DeleteChangeSet/ListStacks/ValidateTemplate. Prod exec role denies `DeleteTable`.
- **B-2 fixed (3c6dbdf)**: `sentinelqa-<env>-artifacts-<AccountId>` (versioned, SSE-S3, BPA, BucketOwnerEnforced, TLS-only policy, noncurrent versions expire after 30 days by default). Exported as `SentinelQA-<env>-ArtifactBucketName`, now imported by 30-api/25-backup. Deploy role has `s3:PutObject/GetObject` on it. Keys: `<commit-sha>/<function>.zip`.
- **Developer #19 fixed (3c6dbdf)**: see D-19.
- **M-7 resolved by runbook**: docs/runbooks/nonprod-table-reset.md + draft `scripts/reset-nonprod-tables.sh`.
- **B-3 partially resolved**: see summary row; repo and OIDC ARN `AllowedPattern` added in 00-bootstrap; runbook docs/runbooks/first-deploy.md added.
- **Boundary/artifact wiring done (Architect, aad1cd1..ff3b1ef)**: 30-api and 25-backup roles carry `PermissionsBoundary` (import `SentinelQA-<env>-AppRoleBoundaryArn`) and import `SentinelQA-<env>-ArtifactBucketName`. `ArtifactBucket` was removed from params (this commit). The 10-security `AlarmEmail` AllowedPattern was added by Architect (1c15d5c). Params were re-checked against all 8 templates: no missing or unknown keys. Non-parameter metadata moved to `_meta`.
- **Origin-verify secret (ADR-0015), this commit**: the boundary allows `kms:Decrypt` on the AWS managed `alias/aws/ssm` key only via `ssm.<region>.amazonaws.com`. App roles' `ssm:GetParameter` on `/sentinelqa/<env>/*` is within the boundary. The deploy role has `ssm:GetParameter` on `/sentinelqa/<env>/edge/origin-verify` only, plus `kms:Decrypt` scoped by ViaService, alias and the `PARAMETER_ARN` encryption context. The pipeline passes it as NoEcho `OriginVerifySecret`. 40-web uses no dynamic reference, so cfn-exec gets no read. The manual creation and rotation steps are in docs/runbooks/first-deploy.md §2a.
- Still open: the pipeline must pass `--role-arn` with the exec role and mask the secret. B-3 still needs Lambda code (B-4, Developer). The table-reset role is not templated.
- **DEV-16 (open design item, not implemented)**: personal or ephemeral envs (e.g. `EnvName` pattern `dev-<name>`). This touches 00-bootstrap `AllowedValues`, the name-prefix scoping (`SentinelQA-dev-*` would also match `SentinelQA-dev-alice-*`, so IAM wildcards must be re-examined for cross-env overlap), the OIDC `sub`/GitHub environments, params files, and a per-profile DeletionPolicy (`AWS::LanguageExtensions`). Proposed for the next round with Architect.

## Findings in detail

### Blockers
**B-1 Deploy role has no permissions to create resources** (blocker, InfraDeploy)
`templates/00-bootstrap.yaml:33-39`: the role may only call CloudFormation change-set APIs and `iam:PassRole` on `SentinelQA-<env>-*`. No CFN service role exists in any template (TODO at line 39, README.md table row 00). CFN therefore executes with the caller's permissions and will fail on IAM, DynamoDB, Lambda, S3, CloudFront, SNS, SSM, Logs and Scheduler. Also missing: `cloudformation:ListStacks/ListChangeSets/DeleteChangeSet`, and `cloudformation:ValidateTemplate` (needed by the pipeline).
*Fix:* add `SentinelQA-<env>-cfn-exec` service role in 00-bootstrap. Scope it to `SentinelQA-<env>-*` names / `/sentinelqa/<env>/*` SSM / `sentinelqa-<env>-*` buckets. Give it a permissions boundary that denies `dynamodb:DeleteItem/UpdateItem` on prod AuditLog and denies IAM actions outside the env prefix. Pass it via `--role-arn`. The deploy role keeps only CFN plus PassRole on that one role. Today PassRole covers every `SentinelQA-<env>-*` role, which also includes Lambda roles, so it is broader than needed.

**B-2 Artifact bucket undefined** (blocker, InfraDeploy)
`templates/30-api.yaml:12-13,89,106` and `templates/25-backup.yaml:10-11,89` take `ArtifactBucket`, and the params set it to `"TODO"` (`params/*.json` 30-api/25-backup). No template creates it. iac/README.md "Deploy flow" also assumes an upload step, but the deploy role (00-bootstrap.yaml:33-38) has no `s3:PutObject`.
*Fix:* create `sentinelqa-<env>-artifacts-<AccountId>` in 00-bootstrap (versioned, SSE-S3, TLS-only, lifecycle). Export it, and grant the deploy role `s3:PutObject/GetObject` on it only.

**B-3 Placeholder parameters** (blocker, Vishwas)
`params/dev.json:7-11`, `stage.json` and `prod.json` (same keys) have `GitHubRepo: "TODO/SentinelQA"`, `OidcProviderArn: "TODO"`, `AlarmEmail: "TODO"`. The 30-api keys are also `TODO`. `AlarmEmail` has no `AllowedPattern` (`templates/10-security.yaml:7-8`), so "TODO" would pass validation and then create a broken subscription. *Fix:* see Prerequisites below. Add `AllowedPattern` for the email, `^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$` for the repo, and an OIDC ARN pattern.

**B-4 No Lambda code** (blocker, Developer)
Repo contains only docs (no `src/`). `30-api.yaml:89,106` and `25-backup.yaml:89,98-101` (export logic is a TODO comment) need real zips. *Fix:* for the first dev deploy, either ship a stub handler zip or deploy 00/10/20 first and hold 30/40/50 until code exists.

### Major
**M-1** `templates/50-observability.yaml:29-37`: `Dimensions: ApiId = TODO-ApiId`. The alarm is created (lint passes) but watches nothing. *Fix:* export `ApiId` from `30-api.yaml` Outputs (lines 174-180) and import it. Also add a `Stage=$default` dimension.

**M-2** `templates/50-observability.yaml:60-74`: DynamoDB `UserErrors` is an account/region-level metric with no `TableName` dimension, so the alarm never gets data (`TreatMissingData: notBreaching` hides this). It also isn't a useful signal for "audit tamper attempts": an IAM deny shows up as AccessDenied in CloudTrail, not as `UserErrors`. *Fix:* replace it with a CloudTrail→metric-filter alarm on `AccessDenied` for the AuditLog ARN (needs CloudTrail, M-8), or with an app-emitted metric.

**M-3** `templates/50-observability.yaml:75-89`: `SentinelQA/ControlledDataBlocked` with `Env` dimension. The records-api must emit it (EMF) with exactly this namespace, name and dimension. Track it as a code contract (ADR-0005/BR-44).

**M-4** `templates/25-backup.yaml:98-101,137-150`: exports are asynchronous. The Lambda returns success after *starting* exports, and a later FAILED export is never alarmed. Nothing alerts if the schedule doesn't run, or if the watermark falls behind and the 35-day PITR window passes (permanent data gap). The function's 300 s timeout (line 86) covers ~60 export calls/month, which is fine. *Fix:* add a daily (or day-3) check that `DescribeExport`s the previous run, and/or a custom `ExportLagDays` metric from the watermark param with an alarm. A FAILED/lag alarm should page. Also add a DLQ/`DeadLetterConfig` on the scheduler target (line 133-136).

**M-5** Rollback/protection: there is no `StackPolicy` for `SentinelQA-prod-Data` / `-Backup`, termination protection isn't specified, and change sets have no `RollbackConfiguration` triggers (iac/README.md "Deploy flow"). `Retain` + `DeletionProtectionEnabled` (`20-data.yaml:17-23,47-52`) protect the tables, but not SSM params or the export bucket policy. *Fix:* runbook/pipeline steps: `--enable-termination-protection` for all prod stacks. A stack policy should deny `Update:Replace`/`Update:Delete` on `DomainTable`, `AuditLogTable` and `ExportBucket`. Change sets should set `RollbackConfiguration` with the 50-observability alarms (prod), and the pipeline should fail on any change set that shows `Replacement: True` for data resources. Document a rollback approach: re-deploy the previous template + artifact key (keep Lambda zips versioned in the artifact bucket).

**M-6** Deploy order / dependencies (iac/README.md, table "Templates (deploy order)"): row 25 sits between 10 and 20, but `25-backup.yaml:66-72,96-97` imports `DomainTableArn`/`AuditLogTableArn` from 20 and `AlarmTopicArn` from 10 (line 150). Correct order: **00 → 10 → 20 → 30 → 40 → 50 → 25 (prod only)**. Import graph: 25←{10,20}; 30←20; 40←30; 50←{10,30}. **No circular references.** Deletion is reverse order and is blocked while imports exist.

**M-7** `templates/20-data.yaml:17-18,47-48`: `DeletionPolicy/UpdateReplacePolicy: Retain` apply in lean too, and table names are fixed (`SentinelQA-<env>-Domain`, line 20/50). If a dev/stage stack is deleted, the tables are orphaned and a re-create fails with "already exists". Any replacement-forcing change (key schema) in dev fails for the same reason. This conflicts with the BR-46 v1.2.2 dev/stage reset allowance (BRD.md line 327). *Fix:* pick one of two options. (a) Use `DeletionPolicy` per profile (CFN doesn't allow `!If` in DeletionPolicy, so use separate conditional resources or accept `Delete` via a lean-only stack). (b) Document the reset procedure as "delete tables manually, then update the stack".

**M-8** Drift detection, audit and spend: `10-security.yaml:16` leaves CloudTrail and Budgets as TODO. There's no drift detection in the pipeline or on a schedule. *Fix:* the CloudTrail trail is account-level and one-off (needed for M-2 and for the AS9100 audit story, cost-estimate.md line 68). Add an AWS Budget with email alerts. Run `detect-stack-drift` before each prod change set, plus weekly via a scheduled GitHub workflow, read-only with OIDC. AWS Config is optional (cost).

### Minor
- **m-1 Tagging** (InfraDeploy): `env` tag only on tables, buckets (`20-data.yaml:44,64`; `25-backup.yaml:36`; `40-web.yaml:19`). Roles, Lambdas, API, distribution, topic and alarms are untagged. In a single account (ADR-0009 resolution), tags are the main cost/ownership separator. *Fix:* pass stack-level `--tags app=SentinelQA env=<env> profile=<lean|strict>` on every deploy, and consider ABAC conditions (`aws:ResourceTag/env`) in the deploy/exec role.
- **m-2 Param files** (InfraDeploy): `params/*.json` use a custom `{all, <stack>}` shape (`_comment` line 2 says "convert to --parameter-overrides"). The converter script doesn't exist. `prod.json` repeats `ArtifactBucket` under 25-backup. dev/stage/prod throttle values are identical (10/20, O-05 decided by Vishwas 2026-10-13). 20-data and 50 receive only `all`, which is correct. Env↔profile is a convention, not enforced: nothing stops `EnvName=prod, EnvProfile=lean`. *Fix:* add a Rule in 20/30/50: `prod ⇒ strict`.
- **m-3 OIDC trust** (InfraDeploy): `00-bootstrap.yaml:24-27` uses `StringEquals` on `aud` and `sub=repo:<repo>:environment:<env>`. This is good: exact match, no wildcards, one role per env. Residual risk: anyone who can run a workflow that targets the `prod` environment can assume the role. *Fix:* in GitHub, set required reviewers plus deployment-branch restriction (`main` only) on `stage`/`prod`. Optionally add a `token.actions.githubusercontent.com:job_workflow_ref` condition pinning the deploy workflow. Set `MaxSessionDuration` to 1 h. Keep the OIDC provider outside per-env stacks, because deleting a dev stack must not remove the shared provider. ADR-0012 line 7 allows creating it in 00-bootstrap. **Don't** do that per env, or the 2nd env fails (one provider per URL per account).
- **m-4 Export coupling** (InfraDeploy): `30-api.yaml:174-180` exports are imported by 40/50. Any change that replaces `HttpApi` or renames the function fails while those imports exist. Accept this, or switch to SSM-parameter wiring.
- **m-5 Web** (Developer): `40-web.yaml:28-53` has no `CustomErrorResponses` (403/404→`/index.html`) for SPA deep links, no `ResponseHeadersPolicyId` (HSTS/CSP), no `PriceClass` (PriceClass_100 is cheaper), and DistributionDomain is not exported (line 71-73).
- **m-6 API** (Developer): `30-api.yaml:153-159` has no `AccessLogSettings`. The route is `ANY /api/records/{proxy+}` (line 144, TODO). Reports fn (97-109) has no `TracingConfig`/`MemorySize`. Log groups are declared separately from the functions (110-119): fine, but add `DependsOn` so the function doesn't create an unmanaged group first.
- **m-7 Backup blast radius** (Architect): the export bucket (`25-backup.yaml:18-36`) is in the same account. With versioning and no delete-deny (O-12, overview §14), an account-admin compromise loses both. Revisit with O-03/O-12. Glacier at day 1 plus 7-y expiry also means restores take hours. That fits O-10.
- **m-8 Tests** (Tester): the pipeline (README "Deploy flow") has no post-deploy smoke test (CloudFront → `/api/records` 200, gate 422 path, audit put). Also missing: the "post-deploy export test" required by ADR-0013 Consequences.
- **m-9 BR-46 resets** (BusinessAnalyst): BRD.md line 327 allows dev/stage admin full-table resets, but no role/runbook defines who does it or how. The Lambda roles explicitly deny delete (`30-api.yaml:49-54`), which is correct. Specify that a reset is an operator action in dev/stage only, ideally `DeleteTable` + stack update, ties to M-7.

### What is in good shape
- Strict/lean conditions applied consistently: PITR, deletion protection, SSE, log retention, X-Ray (`20-data.yaml`, `30-api.yaml:96,114,119`). Prod alarms = 5 + 1 export = 6, matching ADR-0013 and cost-estimate.md line 97.
- Audit append-only via IAM explicit deny (`30-api.yaml:49-51`) matches BR-46/ADR-0006. Reports role is read-only.
- Per-env naming and IAM ARNs scoped to `SentinelQA-<env>-*` and `/sentinelqa/<env>/*`. TLS-only + public-access-block on buckets. OAC with SourceArn condition (`40-web.yaml:54-70`).
- `25-backup` restricted to `EnvName: prod` (line 9). Scheduler role has an `aws:SourceAccount` condition (line 117).
- No CMKs anywhere (O-09) and no `/api/ai/*` route (BRD §12 #1), consistent with docs.

## Prerequisites before the first dev deploy (from Vishwas unless noted)
1. **AWS account ID** (single account, us-east-1) and confirmation that us-east-1 is the target.
2. **GitHub org/owner and repo name** → `GitHubRepo` (e.g. `<org>/SentinelQA`), and confirm GitHub environment names `dev`, `stage`, `prod` (they must match the OIDC `sub`).
3. **Does the IAM OIDC provider `token.actions.githubusercontent.com` already exist in the account?** If yes, provide its ARN (`arn:aws:iam::<acct>:oidc-provider/token.actions.githubusercontent.com`). If no, approve creating it once, out-of-band, not per env.
4. **Alarm email address(es)** per env (dev/stage may share). Someone must click the SNS confirmation email after the 10-security deploy.
5. **Who runs the one-time bootstrap**: 00-bootstrap must be deployed by a human admin session (OIDC role doesn't exist yet). Vishwas, or an approved InfraDeploy session.
6. InfraDeploy: fix B-1 (CFN exec role) and B-2 (artifact bucket) in 00-bootstrap before it's first deployed.
7. Developer: Lambda zips (or stubs) for records-api/reports-api, and the S3 key naming convention (e.g. `<fn>/<git-sha>.zip`).
8. GitHub repo settings: create environments with protection rules (reviewers for stage/prod, branch = main).
9. Decisions still open that affect params (O-05 throttle decided: 10 req/s, burst 20; O-02 log retention decided: 30 days prod): D-07/BR-47 risk weights and due-soon days, D-14 marker list (`20-data.yaml:66-83` placeholders). These are not blocking for dev.
10. Optional but recommended before stage: CloudTrail trail + AWS Budget (M-8). Prod only: pre-go-live checklist in architecture-overview.md §14 (O-10, O-11, O-12, full baseline export).

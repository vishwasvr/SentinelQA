# ADR-0017: Mandatory resource tagging standard

- Status: Accepted (Vishwas, 2026-10-13)
- Date: 2026-10-13
- Deciders: Vishwas (owner), Architect, InfraDeploy

## Context
Owner (Vishwas) requirement: every AWS resource must be tagged with at least `Project=SentinelQA` and `Environment=<dev|stage|prod>`, plus supporting tags. A repo audit (Appendix A) shows tagging is sparse and inconsistent: only 9 resources across the 8 CloudFormation templates declare `Tags`, using lowercase `env` (and `app` on the OIDC provider); no template sets `Project`; no stack-level tags are passed because the repo has no deploy workflow yet (only `.github/workflows/ci.yml`). The live read-only audit of deployed dev/stage stacks could not be completed (CLI session expired, see Appendix B); per Chief of Staff the template audit suffices for now (live audit optional, read-only, before rollout).

## Decision
Tag standard (keys are PascalCase, case-sensitive):

| Key | Required | Value |
|---|---|---|
| `Project` | Yes | `SentinelQA` |
| `Environment` | Yes | `dev` \| `stage` \| `prod` \| `shared` (account-wide) (from `EnvName`) |
| `ManagedBy` | Yes | `CloudFormation` |
| `Repo` | Yes | `vishwasvr/SentinelQA` |

The legacy `env` / `app` keys are replaced by `Environment` / `Project` (kept temporarily during migration only if something depends on them).

Enforcement:
1. **Stack-level tags** via `aws cloudformation deploy --tags Project=SentinelQA Environment=<env> ManagedBy=CloudFormation Repo=vishwasvr/SentinelQA` in the deploy workflow. CloudFormation propagates stack tags to most supported resources.
2. **Explicit `Tags`** in templates on resources where propagation is unreliable or the resource is created outside the stack's tag scope (S3 buckets, DynamoDB tables, log groups, SSM parameters, SNS topics, CloudFront distributions, Scheduler schedules have no tags — see below).
3. **Explicit log groups** (`AWS::Logs::LogGroup` with `Tags` and retention) for every Lambda, so no implicit, untagged log groups are created by Lambda at first invoke.
4. **CI check** in `ci.yml`: a cfn-guard rule (or cfn-lint custom rule / script) that fails when a taggable resource lacks `Project`/`Environment` (or relies on stack tags not present in the deploy command), and that greps the deploy workflow for the required `--tags` keys.
5. **Later (optional)**: AWS Config `required-tags` managed rule and/or an Organizations Tag Policy. Prod lives in a separate account (O-03), so these must be applied per account / at the org level.

Resources that cannot carry tags (no-op for this standard): `AWS::S3::BucketPolicy`, `AWS::Lambda::Permission`, `AWS::ApiGatewayV2::Route`, `AWS::ApiGatewayV2::Integration`, `AWS::CloudFront::OriginAccessControl`, Lambda versions/aliases, `AWS::Scheduler::Schedule` (no Tags property; tag the schedule group instead if required). `AWS::ApiGatewayV2::Stage` and `AWS::ApiGatewayV2::Api` take a map-style `Tags` and are not reliably covered by stack propagation, so tag explicitly. `AWS::IAM::ManagedPolicy` has no Tags property in CloudFormation.

## Consequences
- Cost allocation and ownership become queryable per env; activate `Project`/`Environment` as cost allocation tags in Billing.
- Adding stack-level tags triggers an update on every stack; stateful resources (tables, buckets) are tag-only updates, no replacement.
- Bootstrap/OIDC stacks are account-scoped and InfraDeploy-owned; they are retagged separately.
- Resources created outside CloudFormation (e.g. manually created SSM parameters, implicit Lambda log groups) are not covered and must be imported, recreated in CFN, or tagged manually with approval.

## Implementation plan

**Developer**
- Add explicit `Tags` (`Project`, `Environment`, `ManagedBy`, `Repo`) to app templates 10/20/25/30/40/50, replacing `env`; add tags to Lambda functions, IAM roles, HTTP API + stage, SNS topic, alarms, CloudFront distribution, SSM parameters.
- Ensure every Lambda has an explicit, tagged log group (30-api already has; verify 25-backup tags).
- Add the CI tag check (cfn-guard rule + deploy-command check) to `ci.yml`.

**InfraDeploy**
- Create/update the deploy workflow with `--tags` on every `aws cloudformation deploy`.
- Update `00-bootstrap.yaml` and `00-account-oidc.yaml` to the standard and redeploy them.
- All redeploys require Vishwas approval. The stage Security stack (10-security) must not be redeployed without explicit approval.
- Re-run the read-only live audit (Appendix B) before and after rollout.

## Appendix A: Template audit (repo, 2026-10-13)

| Template | Resource (type) | Declared tag keys | Gap |
|---|---|---|---|
| 00-account-oidc (InfraDeploy) | GitHubOidcProvider (IAM::OIDCProvider) | `app` | Project, Environment n/a (account-scoped: `Environment=shared`, decided by Vishwas 2026-10-13), ManagedBy, Repo |
| 00-bootstrap (InfraDeploy) | ArtifactBucket (S3::Bucket) | `env` | all required keys |
| 00-bootstrap | CfnExecRole, DeployRole (IAM::Role) | none | all |
| 10-security | AlarmTopic (SNS::Topic) | none | all |
| 20-data | DomainTable, AuditLogTable (DynamoDB::Table) | `env` | all required keys |
| 20-data | SSM::Parameter x4 | none | all |
| 20-data | Seed-runs LogGroup (prod only) | `env` | all required keys |
| 25-backup | ExportBucket (S3::Bucket) | `env` | all required keys |
| 25-backup | ExportFn, ExportFnRole, SchedulerRole, ExportFnLogs, alarms | none | all |
| 30-api | RecordsApiFn, ReportsApiFn, roles, log groups, HttpApi, DefaultStage | none | all |
| 40-web | SiteBucket (S3::Bucket) | `env` | all required keys |
| 40-web | Distribution (CloudFront) | none | all |
| 50-observability | CloudWatch alarms | none | all |
| Workflows | — | — | No deploy workflow in repo; no `--tags` anywhere |

## Appendix B: Live audit (dev, stage)
Not completed: on 2026-10-13 the AWS CLI session for account 723940054516 had expired (`aws login` required), so `describe-stacks`, `list-stack-resources` and `resourcegroupstaggingapi get-resources` could not run. Based on templates, deployed resources are expected to carry at most `env` (plus any stack-level tags applied manually). Re-run read-only before implementation and fill this table.

## Decisions (Vishwas, 2026-10-13)
- Exactly 4 required tags: `Project`, `Environment`, `ManagedBy`, `Repo`.
- Account-wide resources (e.g. OIDC provider) use `Environment=shared`.
- No `Owner` tag and no `CostCenter` tag (costs are not tracked that way; per-env/per-project cost views come from `Project` + `Environment` as cost-allocation tags).

## Environment isolation in the shared account (Vishwas, 2026-10-13)
dev and stage share account 723940054516, so `Environment` is the tag that tells them apart.
- `Environment` is **mandatory on every taggable resource**. Allowed values are exactly `dev`, `stage`, `prod`, `shared`. `shared` is only for account-wide resources (OIDC provider, bootstrap/account-level stacks), never for app resources.
- **CI (cfn-guard) must fail** when any taggable resource in an app template (10-50) lacks `Environment`, or has a value that isn't `!Ref EnvName` (constrained by `AllowedValues: [dev, stage, prod]`). Account-level templates (00-*) must use the literal `shared`. The deploy-workflow check must fail if `--tags` lacks `Environment=<env>` matching the target environment.
- **Names carry the env:** every explicitly named resource (stacks, tables, buckets, functions, log groups, SSM paths, alarms, roles) includes the env, e.g. `sentinelqa-<env>-<name>` or `/sentinelqa/<env>/...`, so names never collide between dev and stage. The CI check flags hard-coded names that don't reference `EnvName`. Account-wide resources use `sentinelqa-shared-<name>` or keep their AWS-fixed names.
- IAM policies should scope to env-named ARNs (`sentinelqa-<env>-*`) so one environment's roles can't touch the other's data.

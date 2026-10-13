# IaC outline: plain AWS CloudFormation (YAML)
Status: **skeleton only, never deployed.** Tool: [ADR-0010](../adr/0010-iac-cloudformation.md) (supersedes the CDK choice in ADR-0001).
Single AWS account, us-east-1. Environments are separated by stack name `SentinelQA-<env>-<stack>` and the `EnvName` parameter (D-08).

## Profiles
`EnvProfile` parameter (`lean` for dev/stage, `strict` for prod; [ADR-0013](../adr/0013-environment-profiles.md)). Condition `IsStrict` controls: SSE (strict = AWS managed key `aws/dynamodb`, lean = AWS owned key), PITR, deletion protection (20), log retention 7/90 d, X-Ray (30), extra alarms (50). **No customer-managed KMS keys anywhere (O-09).** `25-backup` is deployed for prod only. Set in [params/](params/).

## Templates (deploy order)
| # | Template | Stack name | Resources | Notes |
|---|---|---|---|---|
| 00 | [00-bootstrap.yaml](templates/00-bootstrap.yaml) | `SentinelQA-<env>-Bootstrap` | GitHub OIDC deploy role scoped to `SentinelQA-<env>-*` | OIDC provider is one per account, pre-existing (ADR-0012). TODO: CFN service role permissions |
| 10 | [10-security.yaml](templates/10-security.yaml) | `SentinelQA-<env>-Security` | SNS email topic (AWS managed key `alias/aws/sns`) | No CMK (O-09). CloudTrail/Budgets TODO (account-level, once) |
| 25 | [25-backup.yaml](templates/25-backup.yaml) | `SentinelQA-prod-Backup` (**prod only**) | Export bucket (SSE-S3, versioned, TLS-only, lifecycle → Glacier Flexible after 1 day, expire after 2557 days ≈ 7 y), export Lambda (least-privilege: `ExportTableToPointInTime`/`DescribeContinuousBackups` on the 2 tables, `DescribeExport`, `s3:PutObject/PutObjectAcl/AbortMultipartUpload` on `exports/*`, one SSM watermark param), EventBridge Scheduler (monthly, day 2 07:00 UTC) + invoke-only role, export-errors alarm | O-01. Requires PITR on (20-data, strict) |
| 20 | [20-data.yaml](templates/20-data.yaml) | `SentinelQA-<env>-Data` | DynamoDB `Domain` (GSI1, GSI2), `AuditLog`. Prod: PITR (required for export), `aws/dynamodb`, deletion protection, Retain, **no TTL** (7-year retention). SSM params: risk weights, due-soon days, controlled-data markers (placeholders, D-07/D-14) | No stream / no Object Lock (D-05) |
| 30 | [30-api.yaml](templates/30-api.yaml) | `SentinelQA-<env>-Api` | HTTP API, `records-api` + `reports-api` Lambdas (nodejs24.x, arm64), least-privilege roles with explicit audit deny (no KMS permissions needed), log groups 90 d, throttling | No `/api/ai/*` route (AI deferred). Authorizer seam |
| 40 | [40-web.yaml](templates/40-web.yaml) | `SentinelQA-<env>-Web` | Private S3 + OAC, CloudFront (`/api/*` → API), TLS-only bucket policy | `WebACLArn` empty (WAF deferred, ADR-0011) |
| 50 | [50-observability.yaml](templates/50-observability.yaml) | `SentinelQA-<env>-Observability` | Lambda error alarm → SNS email | More alarms TODO. AI/agent alarms deferred |

Cross-stack wiring uses exports named `SentinelQA-<env>-<Name>`. Parameter values per env: [params/](params/) (placeholders).

## Validation performed
- `cfn-lint` 1.57.2 (offline): **all 7 templates pass with no errors or warnings** (2026-10-13, rerun after removing CMKs and adding 25-backup).
- `aws cloudformation validate-template`: **not run**, the AWS CLI session had expired. It would be read-only.

## Deploy flow (documented, not executed)
GitHub Actions (OIDC) → `cfn-lint` → upload Lambda zip to the artifact bucket → `aws cloudformation create-change-set` → manual approval for stage/prod → `execute-change-set`. No deploy has been performed from this repo.

## Deferred / removed vs v0.1
Removed: customer-managed KMS keys (O-09), CDK skeleton, Bedrock/Guardrails, AgentTask table, `ai-gateway`, `audit-archiver`, S3 Object Lock, WAF.

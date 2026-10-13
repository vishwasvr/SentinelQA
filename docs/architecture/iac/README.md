# IaC outline: plain AWS CloudFormation (YAML)
Status: **skeleton only, never deployed.** Tool: [ADR-0010](../adr/0010-iac-cloudformation.md) (supersedes the CDK choice in ADR-0001).
Single AWS account, us-east-1. Environments are separated by stack name `SentinelQA-<env>-<stack>` and the `EnvName` parameter (D-08).

## Templates (deploy order)
| # | Template | Stack name | Resources | Notes |
|---|---|---|---|---|
| 00 | [00-bootstrap.yaml](templates/00-bootstrap.yaml) | `SentinelQA-<env>-Bootstrap` | GitHub OIDC deploy role scoped to `SentinelQA-<env>-*` | OIDC provider is one per account, pre-existing (ADR-0012). TODO: CFN service role permissions |
| 10 | [10-security.yaml](templates/10-security.yaml) | `SentinelQA-<env>-Security` | KMS CMK (rotation, Retain), alias, SNS email topic | CloudTrail/Budgets TODO (account-level, once) |
| 20 | [20-data.yaml](templates/20-data.yaml) | `SentinelQA-<env>-Data` | DynamoDB `Domain` (GSI1, GSI2), `AuditLog`. PITR, KMS, deletion protection (non-dev), Retain, **no TTL** (7-year retention). SSM params: risk weights, due-soon days, controlled-data markers (placeholders, D-07/D-14) | No stream / no Object Lock (D-05) |
| 30 | [30-api.yaml](templates/30-api.yaml) | `SentinelQA-<env>-Api` | HTTP API, `records-api` + `reports-api` Lambdas (nodejs24.x, arm64), least-privilege roles with explicit audit deny, log groups 90 d, throttling | No `/api/ai/*` route (AI deferred). Authorizer seam |
| 40 | [40-web.yaml](templates/40-web.yaml) | `SentinelQA-<env>-Web` | Private S3 + OAC, CloudFront (`/api/*` → API), TLS-only bucket policy | `WebACLArn` empty (WAF deferred, ADR-0011) |
| 50 | [50-observability.yaml](templates/50-observability.yaml) | `SentinelQA-<env>-Observability` | Lambda error alarm → SNS email | More alarms TODO. AI/agent alarms deferred |

Cross-stack wiring uses exports named `SentinelQA-<env>-<Name>`. Parameter values per env: [params/](params/) (placeholders).

## Validation performed
- `cfn-lint` 1.57.2 (offline): **all 6 templates pass with no errors or warnings** (2026-10-13).
- `aws cloudformation validate-template`: **not run**, the AWS CLI session had expired. It would be read-only.

## Deploy flow (documented, not executed)
GitHub Actions (OIDC) → `cfn-lint` → upload Lambda zip to the artifact bucket → `aws cloudformation create-change-set` → manual approval for stage/prod → `execute-change-set`. No deploy has been performed from this repo.

## Deferred / removed vs v0.1
Removed: CDK skeleton, Bedrock/Guardrails, AgentTask table, `ai-gateway`, `audit-archiver`, S3 Object Lock, WAF.

# IaC outline: AWS CDK v2 (TypeScript)
Status: **skeleton only, never synthesized or deployed.** Tool choice: [ADR-0001](../adr/0001-iac-tool.md).

## Stacks (per environment: `SentinelQA-<env>-*`)
| Stack | Resources | Notes |
|---|---|---|
| `Security` | KMS CMK (rotation on), CloudTrail trail + bucket, AWS Config recorder (prod), Budgets alarm | Org-level SCPs live outside this repo (D-08) |
| `Data` | DynamoDB `Domain` (PK/SK, GSI1 stage/severity, GSI2 dueDate), `AuditLog` (stream NEW_IMAGE), `AgentTask` (TTL attr `expiresAt`). PITR, CMK, deletion protection + RETAIN in prod | Retention per D-03 |
| `AuditArchive` (prod; optional elsewhere) | S3 bucket with Object Lock (compliance, N years), `audit-archiver` Lambda on the AuditLog stream | D-05 |
| `Ai` | Bedrock Guardrail (+ version), SSM parameters: modelId, marker list, confidence threshold 0.75 | Model access enablement is a manual console/account step |
| `Api` | HTTP API, Lambdas `records-api`, `ai-gateway`, `reports-api`, a per-function IAM role, log groups (retention set), X-Ray | No authorizer yet (ADR-0008 slot) |
| `Web` | S3 site bucket (OAC), CloudFront (`/api/*` → HTTP API), WAFv2 web ACL (scope CLOUDFRONT, must be created in us-east-1), managed rules + rate rule | |
| `Observability` | CloudWatch dashboard, alarms for BR-30 rules (failure rate 5%/1h, timeout 2%/1h, latency 4000 ms/24h, low-confidence 15%/24h, rejection 10%/7d disabled), SNS topic(s) | Channels per D-10 |

Dependency order: Security → Data → (AuditArchive, Ai) → Api → Web → Observability.

## Config (`cdk.json` context per env)
`account`, `region` (us-east-1 proposed), `modelId`, `logRetentionDays`, `auditRetentionYears`, `wafRateLimit`, `alarmEmail`, `seedSampleData` (dev/stage only).

## Guardrails in CI
`cdk synth` + `cdk-nag` AwsSolutions, `cdk diff` on PRs, manual approval for prod. Nothing in this repo runs `cdk deploy`.

## Skeleton files
- [skeleton/bin/app.ts](skeleton/bin/app.ts)
- [skeleton/lib/stacks/data-stack.ts](skeleton/lib/stacks/data-stack.ts)
- [skeleton/lib/stacks/api-stack.ts](skeleton/lib/stacks/api-stack.ts)
- [skeleton/lib/stacks/other-stacks.ts](skeleton/lib/stacks/other-stacks.ts) (Security, Ai, Web, Observability, AuditArchive stubs)

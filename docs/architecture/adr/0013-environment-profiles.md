# ADR-0013: Environment profiles (lean non-prod, strict prod)
- Status: **Accepted** (2026-10-13). O-08, O-09 and O-01 decided by Vishwas. Former ❓ items resolved
- Date: 2026-10-13
- Related: D-03, D-05, D-08, D-10, O-01, O-02, [cost-estimate.md](../cost-estimate.md) §7

## Context
Dev and stage are built first and hold synthetic data. Prod must keep the strict controls. All three run in one account (D-08), and v0.2 applied prod controls everywhere (3 CMKs, PITR, 15 alarms).

## Options
| Option | Pros | Cons |
|---|---|---|
| Same controls in every env (v0.2) | Max parity | ≈ $2.85/mo more now, ≈ $7 by year 7. More alarms/noise |
| **`EnvProfile` = lean / strict parameter** | Cheap non-prod, prod unchanged, one template set | Non-prod doesn't exercise PITR/export paths, so stage is less prod-like |
| Separate templates per env | Explicit | Drift risk, duplication |

## Decision (proposed)
CloudFormation parameter `EnvProfile` (`lean` for dev/stage, `strict` for prod) with condition `IsStrict`:

| Control | lean (dev, stage) | strict (prod) |
|---|---|---|
| DynamoDB encryption | AWS owned key (default, no charge) | **AWS managed key `aws/dynamodb`** (O-09). No CMK anywhere. S3: SSE-S3. SNS: `alias/aws/sns` |
| PITR | off | on |
| Deletion protection | off | on. Retain policies |
| Long-term backup (O-01) | none | **Monthly job → daily-window incremental DynamoDB exports → S3 → Glacier Flexible, 7-year expiry** (`25-backup.yaml`, EventBridge Scheduler + Lambda) |
| Retention (D-03 amended, O-08) | **not applied: synthetic data only** | 7 years for records and audit |
| Audit immutability (D-05) | append-only + IAM deny (kept, free) | same |
| Controlled-data gate (D-14) | on | on |
| Log retention | 7 days | 90 days (O-02) |
| X-Ray | off (PassThrough) | Active |
| Alarms (D-10, email) | 1 (records-api errors) | 6 (Lambda errors, API 5xx, Domain system errors, AuditLog user errors, gate blocks, export errors) |
| Throttling / auth seam / WAF slot | unchanged | unchanged |

Rejected for now: Lambda Function URLs (lose throttling and the JWT authorizer seam for ≈ $0.07/mo), composite alarms (cost more), DynamoDB Standard-IA (more expensive while within the 25 GB free storage), merging dev+stage.

## Consequences
- **Rule (O-08, decided):** non-prod must never contain real customer records. It is unrecoverable and outside the 7-year retention. D-03 is amended to prod only (recorded in ADR-0003).
- **Former decision #4 (stage not exercising KMS permissions): moot.** With no CMKs (O-09), no environment needs `kms:*` IAM permissions or key policies. The remaining prod-only path is PITR + export (`25-backup`), which is covered by prod change-set review and a post-deploy export test.
- **AWS managed key trade-offs (O-09):** no custom key policy or grants, no customer-controlled rotation (AWS rotates automatically), the key can't be disabled or scheduled for deletion (no crypto-shred), and it can't be used cross-account. CloudTrail still records its use. No monthly key fee, but KMS requests to `aws/dynamodb` are billed at $0.03/10k after the account-wide 20k/month free (≈ 20k/month at 20 users, ≈ 99k at 100 users ≈ $0.24).

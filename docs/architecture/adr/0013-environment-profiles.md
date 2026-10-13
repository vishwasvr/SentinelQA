# ADR-0013: Environment profiles (lean non-prod, strict prod)
- Status: **Proposed** (lean/strict split requested by Vishwas 2026-10-13). Items marked ❓ need Vishwas's decision
- Date: 2026-10-13
- Related: D-03, D-05, D-08, D-10, O-01, O-02, [cost-estimate.md](../cost-estimate.md) §7

## Context
Dev and stage are built first and hold synthetic data. Prod must keep the strict controls. All three run in one account (D-08), and v0.2 applied prod controls everywhere (3 CMKs, PITR, 15 alarms).

## Options
| Option | Pros | Cons |
|---|---|---|
| Same controls in every env (v0.2) | Max parity | ≈ $2.85/mo more now, ≈ $7 by year 7. More alarms/noise |
| **`EnvProfile` = lean / strict parameter** | Cheap non-prod, prod unchanged, one template set | Non-prod no longer exercises CMK/PITR paths, so stage is less prod-like |
| Separate templates per env | Explicit | Drift risk, duplication |

## Decision (proposed)
CloudFormation parameter `EnvProfile` (`lean` for dev/stage, `strict` for prod) with condition `IsStrict`:

| Control | lean (dev, stage) | strict (prod) |
|---|---|---|
| DynamoDB encryption | AWS owned key (default, no charge) | 1 customer-managed KMS key (rotation on) ❓ S-2b alternative: AWS-managed key |
| PITR | off | on |
| Deletion protection | off | on. Retain policies |
| Long-term backup (O-01) | none | ❓ S3 incremental export (recommended) or AWS Backup annual |
| Retention (D-03) | **not applied: synthetic data only** ❓ | 7 years for records and audit |
| Audit immutability (D-05) | append-only + IAM deny (kept, free) | same |
| Controlled-data gate (D-14) | on | on |
| Log retention | 7 days | 90 days (O-02) |
| X-Ray | off (PassThrough) | Active |
| Alarms (D-10, email) | 1 (records-api errors) | 5 (Lambda errors, API 5xx, Domain system errors, AuditLog user errors, gate blocks) |
| Throttling / auth seam / WAF slot | unchanged | unchanged |

Rejected for now: Lambda Function URLs (lose throttling and the JWT authorizer seam for ≈ $0.07/mo), composite alarms (cost more), DynamoDB Standard-IA (more expensive while within the 25 GB free storage), merging dev+stage.

## Consequences
- **Rule:** non-prod must never contain real customer records. It is unrecoverable and outside the 7-year retention. ❓ Vishwas to confirm that D-03 applies to prod only.
- Stage no longer tests CMK permissions. Add a pre-prod check (`cfn-lint` + a prod change set review) to cover it.
- Overview §7 "KMS CMK per env" becomes "CMK in prod only".

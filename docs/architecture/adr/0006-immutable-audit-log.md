# ADR-0006: Immutable audit log
- Status: **Accepted** (D-05), Object Lock option rejected
- Date: 2026-10-13
## Context
BR-08/§9: every event writes an immutable activity_log row with actor and snapshot.
## Options
| Option | Pros | Cons |
|---|---|---|
| DynamoDB append-only (conditional put) + IAM explicit deny on update/delete | Simple, cheap | An admin with broad rights can still change it |
| **+ Streams → S3 Object Lock (compliance mode)** | WORM, admins cannot delete within retention | Retention must be decided up front (D-03). Extra component |
| Amazon QLDB | Cryptographic verification | Discontinued by AWS (end of support 2025), not viable |
| Hash chain in items | Tamper evidence | Custom code to verify |
## Decision
> **Superseded in part by the 2026-10-13 Resolution (D-05):** no Object Lock / WORM archive. Kept for history:

~~Append-only table + deny policy in all envs. Object Lock archive in prod, with a hash chain field (`prevHash`) as a cheap tamper signal.~~
## Consequences
Corrections are new events, never edits. Object Lock retention cannot be shortened later.

## Resolution (2026-10-13)
DynamoDB append-only (conditional put) + IAM explicit deny on Update/Delete/BatchWrite. **No S3 Object Lock / WORM archive**: the archive option and the `audit-archiver` stream consumer are removed. The optional `prevHash` field is kept as a cheap tamper signal. Residual risk: an account admin could alter the table. Accepted for now.

## Note (2026-10-13; BRD v1.2 BR-46 codifies this ADR. See overview §15 C-1 on non-prod table resets)
The O-01 backup (incremental exports to a versioned S3 bucket, 7-year lifecycle) gives an **independent copy** of audit events. It is not WORM (no Object Lock, per D-05), but it makes silent tampering in the table detectable against exported history. Bucket deletion hardening (O-12) is deferred to the pre-go-live checklist (overview §14). With no CMK (O-09), "crypto-shred by disabling the key" is not available. That is acceptable, because retention, not destruction, is the requirement.

## C-1 resolution (2026-10-13, BRD v1.2.2 BR-46)
Append-only is **application behaviour**: the app only adds events (conditional put), and single-event `UpdateItem`/`DeleteItem`/`BatchWriteItem` are explicitly denied in **every** environment. **Prod is strictly append-only** (deletion protection, Retain). **Dev/stage admins may fully reset tables** (synthetic data only, BR-45). This is an out-of-app admin action, not an app capability.

## Soft delete and resets (2026-10-13, BRD v1.4 §13.1)
- Domain `DeleteItem`/`BatchWriteItem` are denied in **every** environment, as on AuditLog. Removals and undo are soft deletes or reversals plus a new audit event.
- records-api has read-only `GetItem`/`Query` on AuditLog for the timeline. Update/Delete/BatchWrite stay explicitly denied.
- Dev/stage full-table resets are an operator action: [docs/runbooks/nonprod-table-reset.md](../../runbooks/nonprod-table-reset.md) (InfraDeploy). Never in prod. Re-seed the labelled sample set afterwards (overview §5.2).


## Addendum 2026-10-13: item size (QA-26)
The snapshot holds only the fields this event changed, as `{before, after}` pairs, and is stored gzip-compressed in `snapshotGz`. The Domain item and the compressed audit item are each capped at 350 KB. Anything over the cap gets 413 `item_too_large`, and the transaction makes sure nothing is written. Nothing is ever truncated or moved elsewhere. See overview §4.3.

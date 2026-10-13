# ADR-0006: Immutable audit log
- Status: Proposed (D-05)
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
Append-only table + deny policy in all envs. Object Lock archive in prod, with a hash chain field (`prevHash`) as a cheap tamper signal.
## Consequences
Corrections are new events, never edits. Object Lock retention cannot be shortened later.

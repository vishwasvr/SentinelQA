# ADR-0003: Primary datastore
- Status: **Accepted** (D-03)
- Date: 2026-10-13
## Context
Entities (BRD §6) are document-like, accessed by workspace + type + stage/due date, with small volume. An append-only audit log is required (BR-08). Today the demo stores data in the browser (OQ-04).
## Options
| Option | Pros | Cons |
|---|---|---|
| **DynamoDB (single table + AuditLog + AgentTask)** | Serverless, on-demand, PITR, IAM down to the action level (deny update/delete), Streams for archiving | Ad-hoc reporting (trends, Pareto) needs precomputation or export. Access patterns must be designed up front |
| Aurora PostgreSQL Serverless v2 | Relational, SQL reporting, FKs | Minimum capacity cost, VPC + connection management, coarser DB-level permissions |
| Browser-only (status quo) | Zero backend | No shared records, no server audit trail |
## Decision
DynamoDB, keys prefixed with `WS#<workspaceId>`. Trends (BRD §4.5) are computed by query at pilot scale. Add S3 export + Athena if reporting grows.
## Consequences
Access patterns are documented in the overview §4. Relational migration is possible later via export.

## Resolution (2026-10-13)
Server-side persistence in DynamoDB accepted, replacing browser-only demo storage. Records and audit events are retained **7 years**: no TTL, deletion protection, Retain policies. Long-term backup beyond PITR (35 d) is an open item (O-01). The `AgentTask` table is deferred with AI.

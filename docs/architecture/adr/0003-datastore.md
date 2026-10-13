# ADR-0003: Primary datastore
- Status: Proposed (depends on D-03)
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

# ADR-0008: Auth and tenancy readiness (not implemented)
- Status: Proposed
- Date: 2026-10-13
## Context
Auth, login and multi-tenancy are out of scope (BRD §1.1) but should be addable without rework.
## Options
| Option | Pros | Cons |
|---|---|---|
| **Seams now**: `WS#` key prefix, `actor` object `{name, userId?: null}`, single authorizer slot on API, workspace resolved in middleware | Cheap, no migration later | Small upfront discipline |
| Ignore until needed | Zero effort now | Key migration, rewrite of the audit actor model |
| Build Cognito now | Real identity, real SoD | Out of scope |
## Decision
Seams only. Later: Cognito user pool (Google federation matches the /auth screen) + HTTP API JWT authorizer. Tenant from token claims. Optional DynamoDB `LeadingKeys` IAM condition for tenant isolation.
## Consequences
Until auth exists, SoD (BR-10/33/35/37) relies on self-asserted names and must be labelled advisory.

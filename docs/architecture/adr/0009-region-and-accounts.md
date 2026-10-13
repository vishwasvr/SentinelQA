# ADR-0009: Region, partition and accounts
- Status: **Proposed, needs Vishwas (D-02, D-08)**
- Date: 2026-10-13
## Options
| Option | Pros | Cons |
|---|---|---|
| **us-east-1 commercial** | Widest Bedrock catalog, lowest price, CloudFront/WAF home region | Not suitable for ITAR/CUI (excluded by policy anyway) |
| Other US commercial region | Isolation from us-east-1 incidents | Smaller model catalog |
| AWS GovCloud (US) | ITAR/CUI-eligible | Smaller Bedrock catalog, US-person ops, higher cost. Contradicts the "no controlled data" product stance |
Accounts: single account vs **Organizations with dev/stage/prod accounts** (blast radius, SCPs for audit-delete deny).
## Decision (proposed)
us-east-1, three accounts.
## Consequences
Revisit if any customer requires controlled-data handling.

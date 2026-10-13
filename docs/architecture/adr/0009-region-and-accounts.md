# ADR-0009: Region, partition and accounts
- Status: **Accepted** (D-02); account option amended (D-08)
- Date: 2026-10-13
## Options
| Option | Pros | Cons |
|---|---|---|
| **us-east-1 commercial** | Widest Bedrock catalog, lowest price, CloudFront/WAF home region | Not suitable for ITAR/CUI (excluded by policy anyway) |
| Other US commercial region | Isolation from us-east-1 incidents | Smaller model catalog |
| AWS GovCloud (US) | ITAR/CUI-eligible | Smaller Bedrock catalog, US-person ops, higher cost. Contradicts the "no controlled data" product stance |
Accounts: single account vs **Organizations with dev/stage/prod accounts** (blast radius, SCPs for audit-delete deny).
## Decision (proposed)
> **Superseded in part by the Resolution below (D-08):** single account, not three. Kept for history: ~~us-east-1, three accounts.~~
## Consequences
Revisit if any customer requires controlled-data handling.

## Resolution (2026-10-13)
Region **us-east-1 commercial** accepted. Accounts: **single AWS account** chosen; the three-account Organizations option is **rejected for now**. Environments are separated by stack names/prefixes `SentinelQA-<env>-*`, env-scoped IAM resource ARNs, `env` tags and per-env OIDC deploy roles. Single-account blast radius is open item O-03.

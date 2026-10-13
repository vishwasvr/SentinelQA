# ADR-0005: Controlled-data gate enforcement
- Status: Proposed (D-14)
- Date: 2026-10-13
## Context
BR-04/05: every paste-and-generate action requires "I confirm this text contains no controlled data". Today this is a UI checkbox. A UI-only gate can be bypassed by calling the API directly.
## Options
| Option | Pros | Cons |
|---|---|---|
| UI checkbox only | Matches the demo | Trivially bypassed, no evidence |
| **Server-required attestation + deterministic marker screen + Guardrails** | Defense in depth, auditable outcome, cheap | False positives/negatives. Keyword lists are not proof |
| + ML classifier (Comprehend custom) | Better recall | Training data, cost, still not proof |
| Accept controlled data in GovCloud | Removes the risk class | Major scope/cost change, not in the BRD |
## Decision
Layered gate in `ai-gateway`: (1) reject without `controlledDataAttestation=true`; (2) block on configurable markers (ITAR, EAR, ECCN, EAR99, CUI, NOFORN, "Distribution Statement", "22 CFR 12x", "15 CFR 7xx", "export controlled"); (3) Bedrock Guardrails on input. Record the outcome (not the text) on AgentTask and, for record-creating flows, `controlledDataAttested` on the audit event (proposed answer to OQ-13).
## Consequences
Users can be blocked falsely and need clear messaging. The marker list is owned by the product/compliance owner. The attestation stays the legal control.

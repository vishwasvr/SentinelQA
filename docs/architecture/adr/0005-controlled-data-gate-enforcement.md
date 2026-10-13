# ADR-0005: Controlled-data gate enforcement
- Status: **Accepted** (D-14), amended. Original Decision superseded by the 2026-10-13 Resolution. Implements BRD v1.2 BR-44
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
> **Superseded (2026-10-13) by the Resolution below:** the gate is *not* an AI component. It runs in `records-api` on **every free-text save** (BRD v1.2 **BR-44**). Bedrock Guardrails and AgentTask are removed with AI (D-01). The original text is kept for history:

~~Layered gate in `ai-gateway`: (1) reject without `controlledDataAttestation=true`; (2) block on configurable markers (ITAR, EAR, ECCN, EAR99, CUI, NOFORN, "Distribution Statement", "22 CFR 12x", "15 CFR 7xx", "export controlled"); (3) Bedrock Guardrails on input. Record the outcome (not the text) on AgentTask and, for record-creating flows, `controlledDataAttested` on the audit event (proposed answer to OQ-13).~~
## Consequences
Users can be blocked falsely and need clear messaging. The marker list is owned by the product/compliance owner. The attestation stays the legal control.

## Resolution (2026-10-13)
Keyword hit = **block** (HTTP 422). Layers in the current build: (1) attestation required server-side, (2) configurable marker list (SSM) block. Layer 3 (Bedrock Guardrails) is **removed** with AI. The gate is reconsidered and kept: without AI, pasted/typed free text is persisted for 7 years, so the gate applies to all free-text write endpoints in `records-api`, not only AI calls.

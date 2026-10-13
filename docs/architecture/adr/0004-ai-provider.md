# ADR-0004: AI provider
- Status: **Proposed, needs Vishwas (D-01)**. BRD OQ-05 still open
- Date: 2026-10-13
## Context
The AI drafts CAPA/NCMR/SCAR/FAI/supplier narratives/PO checks with clause citations (BR-01..03). Pasted text must not be retained (BR-06). Controlled data is excluded by policy but could leak by mistake.
## Options
| Option | Pros | Cons |
|---|---|---|
| **Amazon Bedrock** (e.g. Anthropic Claude, Amazon Nova) | IAM auth (no API keys), traffic stays on AWS, no training on inputs, prompts not stored by the service, Guardrails, per-model ARN least privilege, CloudTrail | Model catalog/quotas vary by region. Some newer models need cross-region inference profiles. Model access must be enabled per account |
| Direct vendor API (Anthropic / OpenAI) | Newest models first, vendor features | API key in Secrets Manager, data leaves AWS, separate DPA/zero-retention agreement needed, egress |
| Azure OpenAI | Enterprise terms | Cross-cloud, second identity plane |
| Self-hosted open model (SageMaker) | Full control | GPU cost, MLOps burden, too heavy for the pilot |
## Decision (proposed)
Bedrock, behind a provider interface in `ai-gateway` so another provider can be swapped in. Choose the model after an evaluation on BRD sample cases (NCMR-2026-0087, PO-2026-4471), measuring citation accuracy, hypothesis flagging, latency (<4 s SLO) and token cost.
## Verification
Read-only check of us-east-1 model availability was attempted on 2026-10-13. **It was not possible: the AWS CLI session had expired.** Re-run before the decision:
`aws bedrock list-foundation-models --region us-east-1` and `aws bedrock list-inference-profiles --region us-east-1`.
## Consequences
IAM is pinned to the chosen model ARNs. If a cross-region inference profile is used, the allowed destination regions must be accepted (D-02).

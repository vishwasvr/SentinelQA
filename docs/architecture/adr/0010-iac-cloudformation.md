# ADR-0010: Plain CloudFormation for IaC
- Status: **Accepted** (D-13). Supersedes [ADR-0001](0001-iac-tool.md)
- Date: 2026-10-13
## Context
Vishwas chose plain CloudFormation over CDK.
## Options (from ADR-0001)
CDK (superseded) · SAM (not chosen) · **CloudFormation YAML (chosen)** · Terraform (not chosen).
## Decision
- Hand-written YAML templates in `docs/architecture/iac/templates/`, one per stack, with an `EnvName` parameter (dev|stage|prod).
- Cross-stack references via `Export`/`Fn::ImportValue` named `SentinelQA-<env>-*`.
- Lambda code is packaged as S3 artifacts (bucket/key parameters). No SAM transform.
- Quality gates: `cfn-lint` locally/CI. `aws cloudformation validate-template` when a session is available. Deploy via change sets (ADR-0012).
## Consequences
More verbose than CDK. IAM is fully explicit, which makes it easy to review. No L2 grant helpers, so least-privilege statements are written by hand.

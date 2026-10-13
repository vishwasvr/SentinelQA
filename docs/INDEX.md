# Documentation Index
| Document | Purpose | Last updated |
|---|---|---|
| [requirements/BRD.md](requirements/BRD.md) | Business Requirements Document for Sentinel QA v1.2.3 (as-built, observed behavior + v1.2 architecture scope decisions) | 2026-10-13 |
| [requirements/screenshots/README.md](requirements/screenshots/README.md) | Map of 58 evidence screenshots + reliability CSV export to routes/screens | 2026-10-12 |
| [../README.md](../README.md) | Repository overview | 2026-10-12 |
| [architecture/architecture-overview.md](architecture/architecture-overview.md) | AWS architecture v0.4: services, data flow, data model, IAM, controlled-data gate, retention, environments, resolved decisions D-01..D-14, open items, pre-go-live checklist | 2026-10-13 |
| [architecture/diagrams.md](architecture/diagrams.md) | Mermaid component, write/gate sequence and single-account environment diagrams | 2026-10-13 |
| [architecture/adr/](architecture/adr/) | ADRs: [0001 CDK (Superseded)](architecture/adr/0001-iac-tool.md), [0002 Lambda/TS](architecture/adr/0002-serverless-compute.md), [0003 DynamoDB, 7y](architecture/adr/0003-datastore.md), [0004 AI provider (Deferred)](architecture/adr/0004-ai-provider.md), [0005 controlled-data gate](architecture/adr/0005-controlled-data-gate-enforcement.md), [0006 audit log](architecture/adr/0006-immutable-audit-log.md), [0007 no files](architecture/adr/0007-references-only-no-file-storage.md), [0008 auth seams](architecture/adr/0008-auth-and-tenancy-ready-seams.md), [0009 region/account](architecture/adr/0009-region-and-accounts.md), [0010 CloudFormation](architecture/adr/0010-iac-cloudformation.md), [0011 WAF (Deferred)](architecture/adr/0011-edge-protection-deferred.md), [0012 GitHub OIDC](architecture/adr/0012-ci-cd-github-actions-oidc.md), [0013 env profiles (Accepted)](architecture/adr/0013-environment-profiles.md) | 2026-10-13 |
| [architecture/iac/README.md](architecture/iac/README.md) | CloudFormation templates outline/skeleton incl. prod-only backup stack (not deployed) | 2026-10-13 |
| [architecture/cost-estimate.md](architecture/cost-estimate.md) | Cost estimate v0.4: prod / non-prod (lean vs strict), AWS managed keys, export backup, 20/50/100 users, savings review, 7-year retention and backup options, sources | 2026-10-13 |
- [Architect self-review (v0.4 vs BRD v1.2.2)](reviews/architect-review.md)

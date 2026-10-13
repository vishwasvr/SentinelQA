# ADR-0001: Infrastructure as Code tool
- Status: Proposed (decision D-13)
- Date: 2026-10-13
## Context
We need repeatable dev/stage/prod stacks with least-privilege IAM, KMS, WAF and alarms. The team is small. The application code will likely be TypeScript.
## Options
| Option | Pros | Cons |
|---|---|---|
| **AWS CDK (TypeScript)** | Real language, L2 constructs generate least-privilege grants (`table.grantReadWriteData`), easy per-env config, cdk-nag for compliance checks, synthesizes CloudFormation | Abstraction can hide the generated IAM. Needs a bootstrap per account |
| AWS SAM | Simple for Lambda + API, local invoke | Weak for WAF/KMS/Org/alarms. Grows into raw CFN |
| Raw CloudFormation | No extra tooling, fully explicit | Verbose, no loops/abstraction, hard to review |
| Terraform | Multi-cloud, mature | Not requested, adds state backend management |
## Decision
Use **CDK v2 in TypeScript**, with **cdk-nag** (AwsSolutions pack) in CI and reviewed `cdk diff` output. Skeleton in [../iac/](../iac/README.md).
## Consequences
CloudFormation stays the deploy engine (drift detection, rollback). Engineers need to know CDK. Generated IAM must be reviewed in the synthesized template.

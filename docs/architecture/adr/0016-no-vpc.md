# ADR-0016: Lambda runs outside a VPC (no NAT gateway, no VPC endpoints)

- Status: Accepted
- Date: 2026-10-13
- Deciders: Vishwas (approved via Chief of Staff), Architect

## Context
SentinelQA is fully serverless: CloudFront + private S3, API Gateway HTTP API, Lambda (TypeScript), DynamoDB, SSM Parameter Store (ADR-0002, ADR-0003). None of these needs private networking. ADR-0003 rejected Aurora partly because it would require a VPC and connection management.

## Decision
- Lambda functions are not attached to a VPC.
- No VPC, subnets, NAT gateway or VPC endpoints are provisioned.
- Lambda reaches DynamoDB, S3, SSM and CloudWatch over AWS public service endpoints, authenticated by least-privilege IAM and encrypted with TLS.

## Consequences
- No NAT gateway or interface-endpoint cost; no ENI cold-start or IP-exhaustion concerns.
- Access control relies on IAM, resource policies and the edge controls (ADR-0011, ADR-0015), not network isolation.
- Revisit only if a VPC-only dependency appears (e.g. a private database, on-prem link, or a customer/AS9100 requirement for network isolation). If revisited, prefer gateway endpoints (DynamoDB, S3, free) before any NAT.

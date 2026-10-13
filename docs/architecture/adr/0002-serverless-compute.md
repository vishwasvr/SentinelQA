# ADR-0002: Compute model
- Status: Proposed (D-06)
- Date: 2026-10-13
## Context
Pilot-scale, bursty traffic (A-01). AI calls average ~3 s with a 30 s ceiling (BR-43). Cost should scale to near zero.
## Options
| Option | Pros | Cons |
|---|---|---|
| **API Gateway HTTP API + Lambda** | Pay per request, per-function IAM roles, no servers | 29–30 s API timeout (matches BR-43 but no headroom), cold starts |
| ECS Fargate + ALB | Long requests, streaming, steady containers | Always-on cost, more ops |
| App Runner | Simple container hosting | Coarser IAM, fewer network controls |
## Decision
Lambda behind HTTP API. If streaming responses or >30 s drafts are needed, add Lambda response streaming via Function URL behind CloudFront, or move `ai-gateway` to Fargate.
## Consequences
Strict per-function roles are easy. Long-running drafts need a redesign (async job + polling).

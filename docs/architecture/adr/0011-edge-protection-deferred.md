# ADR-0011: WAF / CAPTCHA deferred
- Status: **Deferred** (D-11)
- Date: 2026-10-13
## Context
Public, unauthenticated endpoints exist. AI endpoints (the main abuse target) are deferred.
## Options
WAF managed rules + rate limit · WAF + CAPTCHA · **API Gateway throttling only (now)**.
## Decision
No WAF in this build. HTTP API default-route throttling: 10 req/s, burst 20 (O-05, decided 2026-10-13). The CloudFront distribution leaves a `WebACLId` parameter slot (empty).
## Consequences
Lower fixed cost. Weaker protection against bots/abuse. Revisit when AI or auth arrives.

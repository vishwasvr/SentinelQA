# ADR-0012: CI/CD with GitHub Actions + OIDC
- Status: **Accepted** (D-12)
- Date: 2026-10-13
## Options
**GitHub Actions + OIDC** · CodePipeline · long-lived access keys (rejected).
## Decision
- An IAM OIDC provider for `token.actions.githubusercontent.com` (created out-of-band or in the bootstrap template `00-bootstrap.yaml`).
- One deploy role per env, trusted for `repo:<org>/SentinelQA:environment:<env>` (`aud=sts.amazonaws.com`), allowed to manage `SentinelQA-<env>-*` stacks and pass only `SentinelQA-<env>-*` roles.
- Pipeline: cfn-lint → package Lambda → create change set → manual approval (GitHub environment protection for stage/prod) → execute.
## Consequences
No stored AWS keys. The org/repo name must be supplied (open).

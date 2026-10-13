# Runbook: move prod into its own AWS account (O-03, pre-go-live)

Status: **PLAN ONLY.** Nothing in this runbook has been run. Every step marked [CREATE] or [WRITE] needs Vishwas's explicit approval at that step. Decision: O-03 (Vishwas, 2026-10-13). Design: overview §7, §13 and §14, plus the addenda to ADR-0009 and ADR-0012 (`e444435`).

## 0. Scope and order
- dev and stage stay in the current shared account. Prod is only ever created in the new account; it's never moved over from the shared account (prod hasn't been bootstrapped yet, since stage/prod bootstrap was deferred).
- This must be finished before the first prod deploy, and before `first-deploy.md` §5a and §6 are run for prod.
- Credentials: temporary `aws login` sessions only. No access keys anywhere, and nothing goes into the repo.

## 1. Create the account [CREATE] (only Vishwas can do this)
1. Vishwas signs in to the management or payer account as admin. Nobody else does this sign-in, and it isn't done from an agent's computer.
2. Create the account through AWS Organizations, named `sentinelqa-prod`, using a dedicated root email address that Vishwas controls. If Organizations isn't set up, a standalone sign-up works instead, but consolidated billing is recommended.
3. Root user: turn on MFA, create no root access keys, and store the recovery details offline.
4. Admin access: use IAM Identity Center (SSO) with a permission set for Vishwas. `aws login` / `aws sso login` then gives the operator a short-lived session for the prod profile.
5. Record the new account ID in `params/prod.json` (an account ID isn't a secret) and in the GitHub environment variable (§4). Keep the account's region as the ADR-0009 region.

## 2. Account baseline [CREATE]
- Set an AWS Budgets alarm on the account (the threshold is a PLACEHOLDER for Vishwas to set), which emails the address in the `prod` GitHub environment variable `ALARM_EMAIL`.
- CloudTrail (M-8) in the prod account, which the 25-backup residual-risk note relies on.
- Turn on S3 account-level Block Public Access.

## 3. OIDC and bootstrap in the new account [CREATE]
These are the same templates and stack names as dev, so stack order follows `first-deploy.md` §3, and the stacks are deployed by hand with the operator's temporary session:
1. `00-account-oidc`: the GitHub OIDC provider, with the trust policy limited to `repo:vishwasvr/SentinelQA:environment:prod`.
2. `00-bootstrap`: the deploy role and cfn-exec role, plus the artifact bucket.
3. Check: `aws sts get-caller-identity` shows the new account ID, and the deploy role's trust policy allows only the prod environment subject.

## 4. GitHub `prod` environment [WRITE, repo settings, not code]
- Variables (not secrets): `AWS_ACCOUNT_ID` = new account ID, `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::<new-id>:role/<deploy role>`, `AWS_REGION` = the ADR-0009 region.
- Required reviewer: Vishwas. Deployments allowed only from `main`.
- dev and stage environment variables still point at the shared account. Check that none of them carry the prod account ID.
- Origin-verify secret (ADR-0015, `first-deploy.md` §2a): generate a new one in the prod account's SSM. Don't reuse the dev/stage value.

## 5. Then the normal prod first deploy
Follow `first-deploy.md` in this order: §3 stacks 10 to 50, then 25-backup; §4 SNS confirmation; §5a PLACEHOLDER gate; §6 backup check. All of these get approval through the GitHub prod environment.

## 6. Isolation checks (read-only)
- No role in either account trusts the other account.
- The deploy role in the shared account can't assume anything in prod (an `sts:AssumeRole` attempt fails).
- `ci-and-data-guards.md` guard 4 still holds: there's no path for copying prod data into nonprod across accounts.

## 7. Cost
- An AWS account itself costs nothing, and so do Organizations and Identity Center.
- Running costs are the same as the prod costs already estimated (same stacks). The only addition is a second CloudTrail/Config baseline: one trail's management events are free, and anything beyond that is small. I haven't priced it, so Architect's cost model is the source for the numbers.
- AWS Budgets: the first two budgets are free.

## 8. Rollback
If the split stalls before go-live, prod stays undeployed. **Don't** fall back to deploying prod into the shared account without a new decision from Vishwas.

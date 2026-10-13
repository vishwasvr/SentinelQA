# Runbook: first deploy (per environment)

Status: Draft. **Do not execute** unless Vishwas explicitly approves each create or update step. Nothing here has been run.

| | |
|---|---|
| Account / region | `723940054516` / `us-east-1` |
| Repo | `vishwasvr/SentinelQA` (GitHub environments `dev`, `stage`, `prod`) |
| Params | `docs/architecture/iac/params/<env>.json` |
| Alarm email | `vishwas.learn@yahoo.com` |

> **First bootstrap (account OIDC stack + `00-bootstrap`) is an admin run by Vishwas:** follow [bootstrap-admin-run.md](bootstrap-admin-run.md). This page covers the overall order and the later pipeline stacks.

## 1. Prerequisites
- Vishwas does a fresh `aws login` / SSO session himself. Agents never hold or create access keys.
- **Explicit approval per create/update.** For each stack, present the change set (`--no-execute-changeset` or `describe-change-set`) and execute it only after Vishwas approves that specific change set.
- `cfn-lint` passes on all templates.
- Lambda zips exist (B-4, Developer) and are uploaded by the pipeline as `<commit-sha>/<function>.zip`.

## 2. GitHub OIDC provider (one per account; check, then create)
The provider belongs to the account-level stack `SentinelQA-Account-OIDC` (`templates/00-account-oidc.yaml`, `params/account.json`). That stack is separate from every per-env stack, and the provider is `Retain`. Set `CreateOidcProvider=true` only if `aws iam list-open-id-connect-providers` shows no GitHub provider. The ARN `arn:aws:iam::723940054516:oidc-provider/token.actions.githubusercontent.com` is unverified until that check runs. Exact steps: [bootstrap-admin-run.md](bootstrap-admin-run.md) §1–2.

## 2a. Origin-verify secret for 40-web (ADR-0015)
`OriginVerifySecret` is **never** stored in params files or in git. Vishwas creates it **once per env**, by hand, before the first 30-api or 40-web deploy:
```bash
ENV=dev
aws ssm put-parameter --name /sentinelqa/$ENV/edge/origin-verify --type SecureString \
  --value "$(openssl rand -hex 32)"      # 64 hex chars (>= 32 required); uses the AWS managed key aws/ssm
```
Do not echo or paste the value anywhere. The command keeps it out of shell history except as the `openssl` subshell.

**Pipeline:** before deploying 40-web, the pipeline runs `aws ssm get-parameter --name /sentinelqa/<env>/edge/origin-verify --with-decryption --query Parameter.Value --output text`, masks the value (`::add-mask::`), and passes it as `--parameter-overrides OriginVerifySecret=...`. The parameter is `NoEcho`, so it never appears in stack output. The deploy role has `ssm:GetParameter` on exactly this parameter, plus `kms:Decrypt` on `aws/ssm` scoped to SSM. CloudFormation never reads it: there is no dynamic reference, because CloudFront can't resolve `ssm-secure`. The API Lambdas read it at runtime through `ORIGIN_VERIFY_PARAM`.

**Rotation** (ADR-0015, zero-downtime order): (1) `put-parameter --overwrite` with `"<new>,<old>"` so the middleware accepts both; (2) wait at least 5 minutes for Lambda caches to refresh; (3) redeploy 40-web through the pipeline with `OriginVerifySecret=<new>` so CloudFront sends the new header; (4) after CloudFront finishes deploying, overwrite the parameter with `"<new>"` only. The pipeline must pass only the first comma-separated value to 40-web. Rotate after any suspected leak, and otherwise on a regular schedule (e.g. every 90 days).

## 3. Stack order (per env)
0. `SentinelQA-Account-OIDC` (once per account; admin, see bootstrap-admin-run.md).
1. `SentinelQA-<env>-Bootstrap` (00): deployed by Vishwas's admin session, **not** by the pipeline, because the deploy role is denied on this stack. Outputs: deploy role, `SentinelQA-<env>-cfn-exec`, the app boundary, and the artifact bucket.
2. The pipeline (deploy role, `--role-arn` = cfn-exec) deploys, in order:
   - 10 `SentinelQA-<env>-Security`
   - 20 `SentinelQA-<env>-Data`
   - 30 `SentinelQA-<env>-Api` (after the zips are uploaded)
   - 40 `SentinelQA-<env>-Web`
   - 50 `SentinelQA-<env>-Observability`
   - 25 `SentinelQA-prod-Backup` (**prod only**, after 20)
3. Prod: enable termination protection and a stack policy (M-5) before the first update.

## 4. SNS confirmation
After 10-security, AWS emails `vishwas.learn@yahoo.com`. Vishwas must click **Confirm subscription**, otherwise no alarms are delivered. Check with `aws sns list-subscriptions-by-topic`: the subscription ARN must not be `PendingConfirmation`.

## 5. GitHub environment protection
- Create the environments `dev`, `stage` and `prod` in `vishwasvr/SentinelQA`. The OIDC `sub` is `repo:vishwasvr/SentinelQA:environment:<env>`.
- `prod`: require manual approval with **required reviewer Vishwas**, deployment branches limited to `main`, and no self-review bypass.
- `stage`: deploy from `main` only. `dev`: unrestricted.
- Store `AWS_ROLE_ARN` (the deploy role ARN from 00) as an environment variable for each environment. No AWS secrets.

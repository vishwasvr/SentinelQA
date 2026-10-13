# Runbook: first deploy (per environment)

Status: Draft. **Do not execute** unless Vishwas explicitly approves each create or update step. Nothing here has been run.

| | |
|---|---|
| Account / region | `723940054516` / `us-east-1` |
| Repo | `vishwasvr/SentinelQA` (GitHub environments `dev`, `stage`, `prod`) |
| Params | `docs/architecture/iac/params/<env>.json` |
| Alarm email | `vishwas.learn@yahoo.com` |

## 1. Prerequisites
- Vishwas does a fresh `aws login` / SSO session himself. Agents never hold or create access keys.
- **Explicit approval per create/update.** For each stack, present the change set (`--no-execute-changeset` or `describe-change-set`) and execute it only after Vishwas approves that specific change set.
- `cfn-lint` passes on all templates.
- Lambda zips exist (B-4, Developer) and are uploaded by the pipeline as `<commit-sha>/<function>.zip`.

## 2. GitHub OIDC provider (one per account; check, then create)
The ARN `arn:aws:iam::723940054516:oidc-provider/token.actions.githubusercontent.com` is **unverified**.
```bash
aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?ends_with(Arn,'token.actions.githubusercontent.com')]"
```
- If it exists, reuse it and do not create a second one.
- If it is missing, create it **once per account, outside the per-env stacks**, after approval:
  `aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com`

## 3. Stack order (per env)
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

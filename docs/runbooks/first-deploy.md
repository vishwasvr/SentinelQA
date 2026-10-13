# Runbook: first deploy (per environment)

Status: Draft. **Do not execute** unless Vishwas explicitly approves each create or update step. Nothing here has been run.

| | |
|---|---|
| Account / region | `723940054516` / `us-east-1` |
| Repo | `vishwasvr/SentinelQA` (GitHub environments `dev`, `stage`, `prod`) |
| Params | `docs/architecture/iac/params/<env>.json` |
| Alarm email | GitHub environment variable `ALARM_EMAIL` (per env; never in params). See [iac README](../architecture/iac/README.md#alarmemail-contract-deploy-time) |

> **First bootstrap (account OIDC stack + `00-bootstrap`) is an admin run by Vishwas:** follow [bootstrap-admin-run.md](bootstrap-admin-run.md). This page covers the overall order and the later pipeline stacks.

## 1. Prerequisites

> **Prod:** prod is deployed only into its own account. Complete `prod-account-split.md` (O-03) first.
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
After 10-security, AWS emails the address in the `<env>` environment's `ALARM_EMAIL` variable. The deploy job runs with `environment: <env>` and passes `AlarmEmail=${{ vars.ALARM_EMAIL }}`; an admin run uses `gh variable get ALARM_EMAIL --env <env>`. Vishwas must click **Confirm subscription**, otherwise no alarms are delivered. Check with `aws sns list-subscriptions-by-topic`: the subscription ARN must not be `PendingConfirmation`.

## 5. GitHub environment protection
- Create the environments `dev`, `stage` and `prod` in `vishwasvr/SentinelQA`. The OIDC `sub` is `repo:vishwasvr/SentinelQA:environment:<env>`.
- `prod`: require manual approval with **required reviewer Vishwas**, deployment branches limited to `main`, and no self-review bypass.
- `stage`: deploy from `main` only. `dev`: unrestricted.
- Store `AWS_DEPLOY_ROLE_ARN` (the deploy role ARN from 00) as an environment variable for each environment. No AWS secrets.

## 5a. Prod gate: no PLACEHOLDER parameters (before the prod deploy approval)

Before the prod reviewer (Vishwas) approves the prod deploy, confirm that no prod SSM parameter is still labelled PLACEHOLDER. This is read-only:

`aws ssm get-parameters-by-path --path /sentinelqa/prod/ --recursive --query "Parameters[?contains(Value, 'PLACEHOLDER')].Name"`

Also check the source files: `rg -n PLACEHOLDER docs/architecture/iac/templates docs/architecture/iac/params` must show no prod-bound values. This covers risk weights, due-soon days and `capa-ncmr/default-due-days`. (SecureString values like the origin secret are not printed. The query returns names only.)

If anything is found, **stop**. Don't approve. Get the tuned value from Vishwas, update it, and re-run this check. Record the result in the run log.

## 6. Post-deploy backup/export verification (prod, 25-backup) — QA-29

Run after 25-backup is first deployed in prod, and again after any change to 25-backup. Use the approved temporary login. Anything marked **[WRITE]** needs Vishwas's explicit approval before it runs. Everything else is read-only.

1. PITR is on for both tables (it must report `ENABLED`):
   `aws dynamodb describe-continuous-backups --table-name <DomainTable>` and the same for `<AuditLogTable>`.
2. Both schedules exist and are `ENABLED`:
   `aws scheduler get-schedule --name SentinelQA-prod-ddb-export-monthly` and `... --name SentinelQA-prod-ddb-export-verify-daily`.
3. The export bucket has public access blocked and default encryption on:
   `aws s3api get-public-access-block --bucket <ExportBucketName>` and `aws s3api get-bucket-encryption --bucket <ExportBucketName>`.
4. **[WRITE]** Take the one-time FULL_EXPORT baseline (go-live), using `aws dynamodb export-table-to-point-in-time` for each table to `s3://<ExportBucketName>/exports/baseline/` with `--s3-sse-algorithm AES256`. Record both export ARNs in the run log.
5. Poll with `aws dynamodb describe-export --export-arn <arn>` until the status is `COMPLETED`. `FAILED` means stop, investigate, and don't sign off.
6. Confirm that objects exist under `exports/baseline/` (`aws s3 ls --recursive`) and that `manifest-summary.json` shows an `itemCount` greater than 0.
7. **[WRITE]** Invoke the function once with `{"mode":"verify"}` (`aws lambda invoke --function-name SentinelQA-prod-ddb-export ...`). Within 15 minutes, check that `SentinelQA/Backup ExportHealthy{Env=prod}` has a datapoint equal to 1 (`aws cloudwatch get-metric-statistics`).
8. Confirm that alarms `SentinelQA-prod-ddb-export-errors` and `SentinelQA-prod-ddb-export-unhealthy` exist and notify the alarm SNS topic (`aws cloudwatch describe-alarms`). `unhealthy` stays `INSUFFICIENT_DATA` or `ALARM` until three daily healthy datapoints exist.
9. After the first monthly run on day 2 of the month, repeat steps 5–7 for the INCREMENTAL exports. Check that `/sentinelqa/prod/backup/last-export-to` has moved forward to the start of the current month (`aws ssm get-parameter`).
10. Restore drill: no restore is done in prod. Doing one needs a short-lived env with prod settings (QA-29 alternative), which needs its own approval.

Record the date, the export ARNs, the step results, and who approved each **[WRITE]** step in the run log in `docs/runbooks/bootstrap-admin-run.md`.

## 5b. Dev smoke pass criteria: audit transaction-only Deny (QA-36)

This is part of the first dev smoke test (#26), which needs its own approval. It checks the `dynamodb:EnclosingOperation` Deny in `30-api.yaml` (audit table).

1. [WRITE] Create one sample record through the API (one `TransactWriteItems` call holding the record and its audit put). **Pass:** 2xx, and the audit event exists.
2. [WRITE] A test-only call that sends a bare `PutItem` to the audit table, made with the API role's session. **Pass:** `AccessDeniedException`, and nothing is written.

If step 1 is denied, stop. Remove only that Deny statement (following Architect's fallback, so the lint rule and the conditional put still apply), get approval and redeploy, then re-run. Don't promote to stage until both steps pass.

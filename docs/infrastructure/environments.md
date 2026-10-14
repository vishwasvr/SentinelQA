# Environments: current state

As of **2026-10-13 ~15:40 CT**. Account `723940054516`, region `us-east-1` (dev and stage share the account). Point-in-time record; update when stacks change. Per-resource list: [aws-resource-inventory.md](aws-resource-inventory.md).

## Shared
| Resource | State | Notes |
|---|---|---|
| `SentinelQA-Account-OIDC` | CREATE_COMPLETE | OIDC provider `token.actions.githubusercontent.com` |

## dev
| Resource | State | Notes |
|---|---|---|
| `SentinelQA-dev-Bootstrap` | CREATE_COMPLETE | Termination protection **OFF**. Exports `CfnExecRoleArn`, `AppRoleBoundaryArn`, `ArtifactBucketName`. Deploy role `SentinelQA-dev-deploy` trusts only `repo:vishwasvr/SentinelQA:environment:dev`. |
| `SentinelQA-dev-Security` | CREATE_COMPLETE | Topic `SentinelQA-dev-alarms`; email subscription PendingConfirmation at time of deploy |
| `SentinelQA-dev-Data` | CREATE_COMPLETE | Tables `SentinelQA-dev-Domain`, `SentinelQA-dev-AuditLog` ACTIVE; profile lean |
| SSM `/sentinelqa/dev/edge/origin-verify` | v1 | SecureString, key `alias/aws/ssm` |
| `SentinelQA-dev-Api` / `-Web` / `-Observability` | **Not deployed** | Blocked, see below |

## stage
| Resource | State | Notes |
|---|---|---|
| `SentinelQA-stage-Bootstrap` | CREATE_COMPLETE | Termination protection **ON**. Outputs: `DeployRoleArn` `arn:aws:iam::723940054516:role/SentinelQA-stage-deploy`, `CfnExecRoleArn` `arn:aws:iam::723940054516:role/SentinelQA-stage-cfn-exec`, `AppRoleBoundaryArn` `arn:aws:iam::723940054516:policy/SentinelQA-stage-app-boundary`, `ArtifactBucketName` `sentinelqa-stage-artifacts-723940054516` |
| `SentinelQA-stage-Security` | CREATE_COMPLETE | Topic `SentinelQA-stage-alarms`; subscription PendingConfirmation |
| `SentinelQA-stage-Data` | CREATE_COMPLETE | Tables `SentinelQA-stage-Domain`, `SentinelQA-stage-AuditLog` ACTIVE; profile lean |
| SSM `/sentinelqa/stage/edge/origin-verify` | v1 | SecureString |
| `SentinelQA-stage-Api` / `-Web` / `-Observability` | **Not deployed** | Blocked, see below |

### Why Api / Web / Observability are not deployed (both envs)
`30-api` needs the build artifacts `<sha>/records-api.zip` and `<sha>/reports-api.zip` in the artifact bucket; `40-web` imports `ApiDomain` and `50-observability` imports `RecordsFnName` / `ApiId` from 30. They go out with the **first pipeline deploy** after the first build.

## GitHub environments
| Item | State |
|---|---|
| `dev`, `stage` environments | Exist |
| dev variable renamed to `AWS_DEPLOY_ROLE_ARN`; dev limited to `main` | Reported by Chief of Staff, not independently verified |
| stage created main-only with `AWS_DEPLOY_ROLE_ARN` | Reported by Chief of Staff, not independently verified |
| `ALARM_EMAIL` variable on each environment (required per PR #6) | Not yet verified |

## Known drift
- **Tags:** deployed stacks are tagged `app=SentinelQA`, `env=<env>` (OIDC provider: `app=SentinelQA`). The repo now follows ADR-0017 for 00-bootstrap and 00-account-oidc (explicit `Project`, `Environment`, `ManagedBy`, `Repo` tags; `Environment=shared` for the account OIDC stack) and the runbook deploy commands pass the matching `--tags`. Deployed stacks **keep the old tags until a Vishwas-approved redeploy**. Redeploying is a tag-only stack update (no resource replacement); stage Bootstrap's termination protection doesn't block updates. Templates 10-50 are being retagged separately (Developer).
- **Deploy role policy (on main via #15):** `00-bootstrap.yaml` now lets `SentinelQA-<env>-deploy` read Bootstrap outputs (`DescribeStacks` only), tag `SentinelQA-<env>-*` stacks (`cloudformation:TagResource`, for `--tags`), `s3:ListBucket` on the env artifact bucket (head-object 404), and `ssm:PutParameter` on `/sentinelqa/<env>/version`. The live dev (and stage) Bootstrap stacks do not have this yet: a Bootstrap redeploy with admin credentials is needed, with Vishwas's approval, before the first `deploy.yml` run. The deploy role cannot apply it itself.
- **`deploy.yml` is manual-only (temporary, Vishwas's decision 2026-10-13):** the `push` trigger is removed, so merges to main don't deploy; only `workflow_dispatch` runs it. Re-enable by restoring the commented `push:` block at the top of `.github/workflows/deploy.yml` in a PR, after (1) the dev/stage Bootstrap and OIDC redeploy is done with Vishwas's approval and (2) `npm run build:lambdas` and `npm run smoke:deployed` are on main (both landed in #18; only (1) remains).
- **AlarmEmail:** the deployed Security stacks got `AlarmEmail` passed directly at deploy time. Future redeploys must take it from the `ALARM_EMAIL` GitHub environment variable (PR #6). The address is never written in the repo.

## Admin session (2026-10-13)
Run by InfraDeploy on Vishwas's temporary `aws login` session (profile `sentinelqa-admin`), each step approved by Vishwas in chat. At ~15:40 CT the session was logged out, the profile removed, caches cleared, and `aws sts get-caller-identity` verified failing. No standing admin credentials remain on the box.

## What's left
1. Verify GitHub environment settings (dev/stage `AWS_DEPLOY_ROLE_ARN`, branch limits) independently.
2. Set and verify `ALARM_EMAIL` on `dev` and `stage` (PR #6).
3. Confirm the SNS email subscriptions for `SentinelQA-dev-alarms` and `SentinelQA-stage-alarms`.
4. Redeploy `SentinelQA-Account-OIDC`, `SentinelQA-dev-Bootstrap` and `SentinelQA-stage-Bootstrap` (ADR-0017 tags + deploy-role policy from #14/#15) as reviewed change sets with admin credentials and Vishwas's approval; required before the first `deploy.yml` run.
5. First manual `deploy.yml` dispatch for dev (build scripts `build:lambdas` / `smoke:deployed` are on main via #18; smoke URL wiring via #17): deploys Api, Web, Observability, then the §5b audit-write probe (Vishwas's OK). Then stage (stage-bootstrap steps 6–9).
6. Re-enable the `push` trigger in `deploy.yml` after items 4–5.
7. Smoke test and sample data in stage (stage-bootstrap step 9).
8. Decide whether to turn termination protection on for `SentinelQA-dev-Bootstrap`.
9. Retag templates 10–50 per ADR-0017 (Developer); 00-bootstrap/00-account-oidc done in repo, live via item 4.

## Runbooks
- [stage-bootstrap.md](../runbooks/stage-bootstrap.md)
- [bootstrap-admin-run.md](../runbooks/bootstrap-admin-run.md)
- [first-deploy.md](../runbooks/first-deploy.md)
- [nonprod-table-reset.md](../runbooks/nonprod-table-reset.md)
- [prod-account-split.md](../runbooks/prod-account-split.md)

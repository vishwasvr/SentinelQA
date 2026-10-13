# Environments: current state

As of **2026-10-13 ~15:40 CT**. Account `723940054516`, region `us-east-1` (dev and stage share the account). Point-in-time record; update when stacks change.

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
- **Tags:** stacks are tagged `app=SentinelQA`, `env=<env>`. The proposed ADR-0017 standard (`Project`, `Environment`, `ManagedBy`, `Repo`) is not yet applied.
- **Deploy role policy (branch `ci/deploy-workflow`):** `00-bootstrap.yaml` now lets `SentinelQA-<env>-deploy` read Bootstrap outputs (`DescribeStacks` only), tag `SentinelQA-<env>-*` stacks (`cloudformation:TagResource`, for `--tags`), `s3:ListBucket` on the env artifact bucket (head-object 404), and `ssm:PutParameter` on `/sentinelqa/<env>/version`. The live dev (and stage) Bootstrap stacks do not have this yet: a Bootstrap redeploy with admin credentials is needed, with Vishwas's approval, before the first `deploy.yml` run. The deploy role cannot apply it itself.
- **AlarmEmail:** the deployed Security stacks got `AlarmEmail` passed directly at deploy time. Future redeploys must take it from the `ALARM_EMAIL` GitHub environment variable (PR #6). The address is never written in the repo.

## Admin session (2026-10-13)
Run by InfraDeploy on Vishwas's temporary `aws login` session (profile `sentinelqa-admin`), each step approved by Vishwas in chat. At ~15:40 CT the session was logged out, the profile removed, caches cleared, and `aws sts get-caller-identity` verified failing. No standing admin credentials remain on the box.

## What's left
1. Verify GitHub environment settings (dev/stage `AWS_DEPLOY_ROLE_ARN`, branch limits) independently.
2. Set and verify `ALARM_EMAIL` on `dev` and `stage` (PR #6).
3. Confirm the SNS email subscriptions for `SentinelQA-dev-alarms` and `SentinelQA-stage-alarms`.
4. Developer adds `npm run build:lambdas` (writes `dist/records-api.zip`, `dist/reports-api.zip`) and `npm run smoke:deployed`; `deploy.yml` (local branch `ci/deploy-workflow`, not pushed) then runs the first build and pipeline first deploy of Api, Web, Observability (dev, then stage; stage-bootstrap steps 6–9).
5. Smoke test and sample data in stage (stage-bootstrap step 9).
6. Decide whether to turn termination protection on for `SentinelQA-dev-Bootstrap`.
7. Apply ADR-0017 tags once accepted.

## Runbooks
- [stage-bootstrap.md](../runbooks/stage-bootstrap.md)
- [bootstrap-admin-run.md](../runbooks/bootstrap-admin-run.md)
- [first-deploy.md](../runbooks/first-deploy.md)
- [nonprod-table-reset.md](../runbooks/nonprod-table-reset.md)
- [prod-account-split.md](../runbooks/prod-account-split.md)

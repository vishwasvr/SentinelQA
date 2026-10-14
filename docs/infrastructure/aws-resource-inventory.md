# AWS resource inventory

Account `723940054516`, region `us-east-1` (dev and stage share the account, ADR-0009). Prod is not deployed and is not in this inventory except where a template defines a prod-only resource.

Compiled 2026-10-14 from the CloudFormation templates in [`docs/architecture/iac/templates/`](../architecture/iac/templates/), the pre-change stack snapshots from the 2026-10-14 redeploy, [environments.md](environments.md), the ADRs and the runbooks. No AWS call was made to compile it.

**Status:** `deployed` = the owning stack (or manual resource) exists in the account; `planned` = defined in a template whose stack is not deployed.
**Last verified:** `2026-10-14` only for the three stacks updated that day (`SentinelQA-Account-OIDC`, `SentinelQA-dev-Bootstrap`, `SentinelQA-stage-Bootstrap`) and their resources. Everything else reads *from template/snapshot, live check pending*.

**Tags:**
- **ADR-0017** = `Project=SentinelQA`, `Environment=<env|shared>`, `ManagedBy=CloudFormation`, `Repo=vishwasvr/SentinelQA`.
- **Old** = `app=SentinelQA`, `env=<env>` stack tags (from the deploy-time `--tags`). The Security and Data stacks keep these until they are retagged. Some 20-data resources also carry a resource-level `env` tag from the template.

This file holds no secret values, emails, tokens or credentials. Only names and ARN patterns.

## IAM users (manual)
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `arn:aws:iam::723940054516:user/vishwas.learn.admin` | shared | manual | Admin identity. Vishwas uses it through `aws login` (temporary credentials, profile `sentinelqa-admin`) for Bootstrap, OIDC and manual runbook steps | unknown (not IaC-managed) | deployed | from template/snapshot, live check pending |
| `arn:aws:iam::723940054516:user/sentinelqa-bootstrap` | shared | manual | Legacy bootstrap IAM user. `stage-bootstrap.md` says **not** to use it (no long-term access keys) | unknown | deployed? (named in the runbook; existence and keys not verified) | from template/snapshot, live check pending |

## IAM roles
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `arn:aws:iam::723940054516:role/SentinelQA-dev-deploy` | dev | SentinelQA-dev-Bootstrap | GitHub Actions deploy role; OIDC trust on `repo:vishwasvr/SentinelQA:environment:dev` only | ADR-0017 | deployed | 2026-10-14 |
| `arn:aws:iam::723940054516:role/SentinelQA-dev-cfn-exec` | dev | SentinelQA-dev-Bootstrap | CloudFormation execution role for stacks 10–50; may create roles only with the app boundary | ADR-0017 | deployed | 2026-10-14 |
| `arn:aws:iam::723940054516:role/SentinelQA-stage-deploy` | stage | SentinelQA-stage-Bootstrap | Deploy role; trusts `repo:vishwasvr/SentinelQA:environment:stage` only | ADR-0017 | deployed | 2026-10-14 |
| `arn:aws:iam::723940054516:role/SentinelQA-stage-cfn-exec` | stage | SentinelQA-stage-Bootstrap | CloudFormation execution role | ADR-0017 | deployed | 2026-10-14 |
| `role/SentinelQA-<env>-records-api` | dev, stage | SentinelQA-<env>-Api (30-api) | Records Lambda role (boundary = app boundary) | stack tags at deploy | planned | from template/snapshot, live check pending |
| `role/SentinelQA-<env>-reports-api` | dev, stage | SentinelQA-<env>-Api (30-api) | Reports Lambda role (boundary = app boundary) | stack tags at deploy | planned | from template/snapshot, live check pending |
| `role/SentinelQA-prod-ddb-export`, `role/SentinelQA-prod-ddb-export-scheduler` | prod | SentinelQA-prod-Backup (25-backup, prod only) | DynamoDB export Lambda and its EventBridge Scheduler invoker | stack tags at deploy | planned | from template/snapshot, live check pending |

## IAM policies and permissions boundaries
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `arn:aws:iam::723940054516:policy/SentinelQA-dev-app-boundary` | dev | SentinelQA-dev-Bootstrap | Required permissions boundary for every role made by stacks 10–50 | none in template (managed policy, not tagged) | deployed | 2026-10-14 |
| `arn:aws:iam::723940054516:policy/SentinelQA-stage-app-boundary` | stage | SentinelQA-stage-Bootstrap | Same, stage | none in template | deployed | 2026-10-14 |
| Inline `env-scoped-provisioning` on `SentinelQA-<env>-cfn-exec` | dev, stage | SentinelQA-<env>-Bootstrap | Env-scoped provisioning rights | n/a (inline) | deployed | 2026-10-14 |
| Inline `env-scoped-deploy` on `SentinelQA-<env>-deploy` | dev, stage | SentinelQA-<env>-Bootstrap | Deploy rights incl. #15 additions (`DescribeStacks`, `cloudformation:TagResource`, `s3:ListBucket`, `ssm:PutParameter` on `/sentinelqa/<env>/version`) | n/a (inline) | deployed | 2026-10-14 |
| `policy/SentinelQA-prod-seed-runs-write` | prod | SentinelQA-prod-Data (20-data, `IsProd`) | Prod seed operator writes to `/sentinelqa/prod/seed-runs` only | none in template | planned | from template/snapshot, live check pending |
| Inline `least-privilege` on records/reports roles; `least-privilege-export`, `invoke-export-fn` on backup roles | dev, stage / prod | 30-api / 25-backup | Function-scoped access | n/a | planned | from template/snapshot, live check pending |

## OIDC provider
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `arn:aws:iam::723940054516:oidc-provider/token.actions.githubusercontent.com` | shared | SentinelQA-Account-OIDC (`CreateOidcProvider=true`) | GitHub Actions federation (ADR-0012); trusted by the env deploy roles | ADR-0017 (`Environment=shared`) | deployed | 2026-10-14 |

## CloudFormation stacks
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `SentinelQA-Account-OIDC` | shared | n/a (00-account-oidc) | Account OIDC provider | ADR-0017 | deployed (UPDATE_COMPLETE 2026-10-14) | 2026-10-14 |
| `SentinelQA-dev-Bootstrap` | dev | n/a (00-bootstrap) | Deploy/exec roles, boundary, artifact bucket. Termination protection **OFF** | ADR-0017 | deployed | 2026-10-14 |
| `SentinelQA-stage-Bootstrap` | stage | n/a (00-bootstrap) | Same. Termination protection **ON** | ADR-0017 | deployed | 2026-10-14 |
| `SentinelQA-dev-Security`, `SentinelQA-stage-Security` | dev, stage | n/a (10-security) | Alarm SNS topic | Old | deployed | from template/snapshot, live check pending |
| `SentinelQA-dev-Data`, `SentinelQA-stage-Data` | dev, stage | n/a (20-data) | DynamoDB tables, SSM config parameters (lean profile) | Old | deployed | from template/snapshot, live check pending |
| `SentinelQA-<env>-Api` | dev, stage | n/a (30-api) | HTTP API + Lambdas | ADR-0017 at deploy | planned | from template/snapshot, live check pending |
| `SentinelQA-<env>-Web` | dev, stage | n/a (40-web) | Site bucket, CloudFront | ADR-0017 at deploy | planned | from template/snapshot, live check pending |
| `SentinelQA-<env>-Observability` | dev, stage | n/a (50-observability) | CloudWatch alarms | ADR-0017 at deploy | planned | from template/snapshot, live check pending |
| `SentinelQA-prod-Backup` | prod | n/a (25-backup) | Monthly DynamoDB export (prod only) | ADR-0017 at deploy | planned | from template/snapshot, live check pending |

Termination protection on the Security and Data stacks is not recorded anywhere; check it live.

## S3 buckets
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `sentinelqa-dev-artifacts-723940054516` | dev | SentinelQA-dev-Bootstrap | Lambda build artifacts (`<sha>/*.zip`); noncurrent versions expire after 30 days | ADR-0017 | deployed | 2026-10-14 |
| `sentinelqa-stage-artifacts-723940054516` | stage | SentinelQA-stage-Bootstrap | Same, stage | ADR-0017 | deployed | 2026-10-14 |
| Web site bucket (CloudFormation-generated name) | dev, stage | SentinelQA-<env>-Web | SPA static site behind CloudFront OAC | `env` (template) + stack tags | planned | from template/snapshot, live check pending |
| `sentinelqa-prod-ddb-exports-723940054516` | prod | SentinelQA-prod-Backup | DynamoDB export target | stack tags | planned | from template/snapshot, live check pending |

## DynamoDB tables
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `SentinelQA-dev-Domain` | dev | SentinelQA-dev-Data | Domain records (GSI1–3); lean | Old + `env=dev` | deployed | from template/snapshot, live check pending |
| `SentinelQA-dev-AuditLog` | dev | SentinelQA-dev-Data | Append-only audit log (Retain) | Old + `env=dev` | deployed | from template/snapshot, live check pending |
| `SentinelQA-stage-Domain` | stage | SentinelQA-stage-Data | Domain records; lean | Old + `env=stage` | deployed | from template/snapshot, live check pending |
| `SentinelQA-stage-AuditLog` | stage | SentinelQA-stage-Data | Audit log (Retain) | Old + `env=stage` | deployed | from template/snapshot, live check pending |

## Secrets
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| dev origin-verify secret (Secrets Manager, name not recorded in the repo) | dev | manual | Reported 2026-10-14 as a dev origin-verify secret in Secrets Manager. ADR-0015 stores the value in SSM (below) instead; confirm whether this is a duplicate or a mislabelled SSM parameter | unknown | deployed (reported) | from template/snapshot, live check pending |
| `/sentinelqa/dev/edge/origin-verify` (SSM SecureString, `alias/aws/ssm`) | dev | manual | CloudFront to API `X-Origin-Verify` value (ADR-0015) | unknown | deployed (v1) | from template/snapshot, live check pending |
| `/sentinelqa/stage/edge/origin-verify` (SSM SecureString) | stage | manual | Same, stage (separate value) | unknown | deployed (v1) | from template/snapshot, live check pending |

## SSM parameters (configuration)
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `/sentinelqa/<env>/supplier-risk/weights` | dev, stage | SentinelQA-<env>-Data | BR-47 risk weights (PLACEHOLDER) | stack tags (Old) | deployed | from template/snapshot, live check pending |
| `/sentinelqa/<env>/due-soon-days` | dev, stage | SentinelQA-<env>-Data | Due-soon thresholds (PLACEHOLDER) | Old | deployed | from template/snapshot, live check pending |
| `/sentinelqa/<env>/capa-ncmr/default-due-days` | dev, stage | SentinelQA-<env>-Data | CAPA/NCMR default due N (PLACEHOLDER, DP-20) | Old | deployed | from template/snapshot, live check pending |
| `/sentinelqa/<env>/workspace/timezone` | dev, stage | SentinelQA-<env>-Data | Workspace timezone (DP-12) | Old | deployed | from template/snapshot, live check pending |
| `/sentinelqa/<env>/controlled-data/markers` | dev, stage | SentinelQA-<env>-Data | BR-44 keyword markers | Old | deployed | from template/snapshot, live check pending |
| `/sentinelqa/<env>/controlled-data/cfr-ranges` | dev, stage | SentinelQA-<env>-Data | BR-44 CFR ranges | Old | deployed | from template/snapshot, live check pending |
| `/sentinelqa/<env>/version` | dev, stage | manual (written by `deploy.yml`) | Deployed version marker | n/a | planned (written on the first deploy) | from template/snapshot, live check pending |
| `/sentinelqa/prod/backup/last-export-to` | prod | SentinelQA-prod-Backup (written by the export Lambda) | Incremental export watermark | n/a | planned | from template/snapshot, live check pending |

## Lambda functions (and log groups)
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `SentinelQA-<env>-records-api` + `/aws/lambda/SentinelQA-<env>-records-api` | dev, stage | SentinelQA-<env>-Api | Records API (writes, gate, audit) | stack tags | planned | from template/snapshot, live check pending |
| `SentinelQA-<env>-reports-api` + log group | dev, stage | SentinelQA-<env>-Api | Reports API (read-only) | stack tags | planned | from template/snapshot, live check pending |
| `SentinelQA-prod-ddb-export` + log group; schedules `SentinelQA-prod-ddb-export-monthly`, `-verify-daily` | prod | SentinelQA-prod-Backup | DynamoDB export | stack tags | planned | from template/snapshot, live check pending |
| `/sentinelqa/prod/seed-runs` log group | prod | SentinelQA-prod-Data (`IsProd`) | Prod seed run records, 7 years | `env=prod` | planned | from template/snapshot, live check pending |

Related planned edge resources (30-api / 40-web): HTTP API (`$default` stage), CloudFront distribution and OAC `SentinelQA-<env>-oac`.

## CloudWatch alarms and SNS
| Name or ARN pattern | Env | Owning stack | Purpose | Tags | Status | Last verified |
|---|---|---|---|---|---|---|
| `arn:aws:sns:us-east-1:723940054516:SentinelQA-dev-alarms` | dev | SentinelQA-dev-Security | Alarm topic, email subscription (address not recorded here; was PendingConfirmation) | Old | deployed | from template/snapshot, live check pending |
| `arn:aws:sns:us-east-1:723940054516:SentinelQA-stage-alarms` | stage | SentinelQA-stage-Security | Same, stage | Old | deployed | from template/snapshot, live check pending |
| `SentinelQA-<env>-records-api-errors`, `-ApiServerErrors`, `-DomainSystemErrors`, `-AuditSystemErrors` | dev, stage | SentinelQA-<env>-Observability | Lambda/API/DynamoDB error alarms to the alarm topic (some are strict-profile only) | stack tags | planned | from template/snapshot, live check pending |
| `SentinelQA-<env>-GateBlocks` | strict envs only | SentinelQA-<env>-Observability | Controlled-data gate blocks ≥10/5 min | stack tags | planned | from template/snapshot, live check pending |
| `SentinelQA-prod-ddb-export-errors`, `-ddb-export-unhealthy` | prod | SentinelQA-prod-Backup | Export failure alarms | stack tags | planned | from template/snapshot, live check pending |

## Summary (dev + stage + shared, deployed)
2 IAM users (manual; the bootstrap user is unconfirmed) · 4 roles · 2 boundary policies (+ 4 inline) · 1 OIDC provider · 7 stacks · 2 S3 buckets · 4 DynamoDB tables · 3 secrets (1 Secrets Manager reported, 2 SSM SecureString) · 12 SSM config parameters (6 per env) · 0 Lambdas · 2 SNS topics, 0 alarms.

## Maintaining this inventory
- Update this file **with every deploy or change** to the account (stack create/update/delete, manual SSM/Secrets Manager/IAM change, termination protection, tags). Do it as part of the runbook **run log** step: the same PR that records the run in the runbook's run log updates the affected rows here and `environments.md`.
- When a row is checked live, set **Last verified** to that date; otherwise leave *from template/snapshot, live check pending*. Change **Status** from `planned` to `deployed` when the stack is created.
- When a stack is retagged to ADR-0017 (Security, Data next), change its rows from `Old` to `ADR-0017`.
- Never add secret values, emails, tokens or credentials. Names and ARN patterns only.

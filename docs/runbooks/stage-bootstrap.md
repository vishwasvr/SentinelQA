# Runbook: stage bootstrap (shared non-prod account)

Status: Draft, **not run**. Extends delivery-strategy.md §1a (the plan) and reuses [bootstrap-admin-run.md](bootstrap-admin-run.md) / [first-deploy.md](first-deploy.md); it does not replace them.
Agents never execute this. **Vishwas runs every command himself**, in his own admin session, and signs the `APPROVAL` line of each step before executing it.

| | |
|---|---|
| Account / region | `723940054516` / `us-east-1` (shared with dev) |
| When | Once build opens (Vishwas decision) |
| Templates | `docs/architecture/iac/templates/` 00-bootstrap, 10-security, 20-data, 30-api, 40-web, 50-observability. **No 25-backup** (prod only). 00-account-oidc already exists (shared with dev). |
| Params | `docs/architecture/iac/params/stage.json` (`EnvName=stage`, `EnvProfile=lean`) |
| Data | **Sample data only** (BR-49 / US-43): creates without `isSample=true` return 422 `non_sample_data_forbidden`. Never copy prod data. |

## 0. Prerequisites
- Runner: Vishwas, admin principal, via `aws login --profile sentinelqa-admin` (temporary credentials). **Every command uses `--profile sentinelqa-admin`. No long-term access keys**; do not use the `sentinelqa-bootstrap` IAM user. Log out when done.
- Tools: bash, `jq`, repo root checked out at the commit being bootstrapped.
- Confirm identity and region (Vishwas runs this; agents do not):
```bash
aws login --profile sentinelqa-admin
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
aws sts get-caller-identity --profile sentinelqa-admin     # Account MUST be 723940054516; Arn MUST be an admin principal
T=docs/architecture/iac/templates; P=docs/architecture/iac/params/stage.json; ENV=stage
aws cloudformation describe-stacks --profile sentinelqa-admin --stack-name SentinelQA-Account-OIDC --query "Stacks[0].Outputs"   # must exist
```
APPROVAL (identity/region correct): Vishwas ____

### Change-set pattern (every step)
Every step creates a change set with `--no-execute-changeset`, then:
```bash
aws cloudformation describe-change-set --profile sentinelqa-admin --change-set-name <CHANGE_SET_ARN> \
  --query "Changes[].ResourceChange.{Action:Action,Type:ResourceType,Id:LogicalResourceId,Replace:Replacement}" --output table
# Review. Only after signing APPROVAL:
aws cloudformation execute-change-set --profile sentinelqa-admin --change-set-name <CHANGE_SET_ARN>
aws cloudformation wait --profile sentinelqa-admin stack-create-complete --stack-name <STACK>
# Reject instead:  aws cloudformation delete-change-set --profile sentinelqa-admin --change-set-name <CHANGE_SET_ARN>
```
Stacks 10–50 must pass `--role-arn` = the stage cfn-exec role (the deploy role is denied any change set without it). **Decided (Vishwas): the first stage run of 10–50 is MANUAL** from Vishwas's admin session (`--profile sentinelqa-admin`), one approved step at a time. Later stage deploys go through the pipeline (OIDC deploy role). Delete env stacks in reverse order (50 → 10) because later stacks import earlier exports.

## 1. GitHub `stage` environment [WRITE, repo settings]
In `vishwasvr/SentinelQA` → Settings → Environments → **New environment `stage`**:
- Deployment branches: **`main` only** (first-deploy.md §5). No tag rules.
- Required reviewers: **none** (decided). The stage gate is in the workflow: unit tests, coverage gate (delivery-strategy §3b), and `releases/<sha>/dev-signoff.md` whose SHA matches the commit being deployed.
- Variable `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::723940054516:role/SentinelQA-stage-deploy` (set after step 2; not a secret).
- The stage deploy job **must** declare `environment: stage` so the OIDC `sub` is `repo:vishwasvr/SentinelQA:environment:stage` (ADR-0012). Tag-triggered runs (`ref:refs/tags/v*`) and `pull_request` runs are **not trusted** and cannot assume the role.

APPROVAL: Vishwas ____

## 2. `SentinelQA-stage-Bootstrap` (00-bootstrap) — admin only
Creates: artifact bucket `sentinelqa-stage-artifacts-723940054516` (+TLS-only policy, Retain), boundary `SentinelQA-stage-app-boundary`, `SentinelQA-stage-cfn-exec`, `SentinelQA-stage-deploy` (OIDC trust, see §OIDC). Exports `SentinelQA-stage-{CfnExecRoleArn,AppRoleBoundaryArn,ArtifactBucketName}`.
```bash
aws cloudformation deploy --profile sentinelqa-admin --stack-name SentinelQA-stage-Bootstrap \
  --template-file $T/00-bootstrap.yaml \
  --parameter-overrides EnvName=stage GitHubRepo=vishwasvr/SentinelQA \
    OidcProviderArn=arn:aws:iam::723940054516:oidc-provider/token.actions.githubusercontent.com \
  --capabilities CAPABILITY_NAMED_IAM --tags app=SentinelQA env=stage --no-execute-changeset
# expect 6 x Add
# after execute + wait (decided: termination protection ON for stage Bootstrap):
aws cloudformation update-termination-protection --enable-termination-protection --stack-name SentinelQA-stage-Bootstrap --profile sentinelqa-admin
```
Verify:
```bash
aws cloudformation describe-stacks --profile sentinelqa-admin --stack-name SentinelQA-stage-Bootstrap --query "Stacks[0].EnableTerminationProtection"   # true
aws cloudformation describe-stacks --profile sentinelqa-admin --stack-name SentinelQA-stage-Bootstrap --query "Stacks[0].Outputs" --output table
aws iam get-role --profile sentinelqa-admin --role-name SentinelQA-stage-deploy --query Role.AssumeRolePolicyDocument
#  StringEquals aud=sts.amazonaws.com AND sub=repo:vishwasvr/SentinelQA:environment:stage  (exact; no wildcard, no StringLike)
aws s3api get-public-access-block --profile sentinelqa-admin --bucket sentinelqa-stage-artifacts-723940054516
```
Rollback (needs its own APPROVAL): first disable protection with `aws cloudformation update-termination-protection --no-enable-termination-protection --stack-name SentinelQA-stage-Bootstrap --profile sentinelqa-admin`, then `aws cloudformation delete-stack --profile sentinelqa-admin --stack-name SentinelQA-stage-Bootstrap` (only after 10–50 are deleted); bucket is Retain, empty and delete it per bootstrap-admin-run.md §7.

APPROVAL: Vishwas ____

## 3. Origin-verify secret (SSM SecureString, not a stack)
Creates `/sentinelqa/stage/edge/origin-verify`, a **new** value (never dev's; ADR-0015). Do not paste the value anywhere else.
```bash
aws ssm put-parameter --profile sentinelqa-admin --name /sentinelqa/stage/edge/origin-verify --type SecureString \
  --value "$(openssl rand -hex 32)" --tags Key=app,Value=SentinelQA Key=env,Value=stage
```
Verify: `aws ssm describe-parameters --profile sentinelqa-admin --parameter-filters Key=Name,Values=/sentinelqa/stage/edge/origin-verify`
Rollback: `aws ssm delete-parameter --profile sentinelqa-admin --name /sentinelqa/stage/edge/origin-verify`

APPROVAL: Vishwas ____

```bash
EXEC=$(aws cloudformation list-exports --profile sentinelqa-admin --query "Exports[?Name=='SentinelQA-stage-CfnExecRoleArn'].Value" --output text)
```

## 4. `SentinelQA-stage-Security` (10-security)
Creates SNS topic `SentinelQA-stage-alarms` (+ email subscription). Export `SentinelQA-stage-AlarmTopicArn`.
```bash
aws cloudformation deploy --profile sentinelqa-admin --stack-name SentinelQA-stage-Security --template-file $T/10-security.yaml \
  --parameter-overrides EnvName=stage AlarmEmail="$(jq -r '.["10-security"].AlarmEmail' $P)" \
  --role-arn "$EXEC" --tags app=SentinelQA env=stage --no-execute-changeset
```
Verify: `aws sns list-subscriptions-by-topic --profile sentinelqa-admin --topic-arn $(aws cloudformation list-exports --profile sentinelqa-admin --query "Exports[?Name=='SentinelQA-stage-AlarmTopicArn'].Value" --output text)`; confirm the email (first-deploy §4).
Rollback: `aws cloudformation delete-stack --profile sentinelqa-admin --stack-name SentinelQA-stage-Security`

APPROVAL: Vishwas ____

## 5. `SentinelQA-stage-Data` (20-data, lean)
Creates DynamoDB `SentinelQA-stage-Domain`, `SentinelQA-stage-AuditLog`, SSM config parameters under `/sentinelqa/stage/…`, seed-runs log group, seed-runs write policy (lean: PITR off).
```bash
aws cloudformation deploy --profile sentinelqa-admin --stack-name SentinelQA-stage-Data --template-file $T/20-data.yaml \
  --parameter-overrides EnvName=stage EnvProfile=lean \
  --capabilities CAPABILITY_NAMED_IAM --role-arn "$EXEC" --tags app=SentinelQA env=stage --no-execute-changeset
```
Verify: `aws dynamodb describe-table --profile sentinelqa-admin --table-name SentinelQA-stage-Domain --query Table.TableStatus` (and AuditLog) → `ACTIVE`.
Rollback: `aws cloudformation delete-stack --profile sentinelqa-admin --stack-name SentinelQA-stage-Data` (sample data only; see nonprod-table-reset.md).

APPROVAL: Vishwas ____

## 6. `SentinelQA-stage-Api` (30-api, lean)
Prereq: `records-api.zip` and `reports-api.zip` for `<sha>` uploaded to `s3://sentinelqa-stage-artifacts-723940054516/<sha>/` (pipeline build step).
Creates Lambda roles/functions `SentinelQA-stage-records-api` / `-reports-api` (with boundary), log groups, HTTP API `SentinelQA-stage-api` and routes.
```bash
SHA=<commit-sha>
aws cloudformation deploy --profile sentinelqa-admin --stack-name SentinelQA-stage-Api --template-file $T/30-api.yaml \
  --parameter-overrides EnvName=stage EnvProfile=lean \
    RecordsApiKey=$SHA/records-api.zip ReportsApiKey=$SHA/reports-api.zip ThrottleRate=10 ThrottleBurst=20 \
  --capabilities CAPABILITY_NAMED_IAM --role-arn "$EXEC" --tags app=SentinelQA env=stage --no-execute-changeset
```
Verify: `aws cloudformation describe-stacks --profile sentinelqa-admin --stack-name SentinelQA-stage-Api --query "Stacks[0].Outputs" --output table`
Rollback: `aws cloudformation delete-stack --profile sentinelqa-admin --stack-name SentinelQA-stage-Api`

APPROVAL: Vishwas ____

## 7. `SentinelQA-stage-Web` (40-web)
Creates web S3 bucket, CloudFront OAC + distribution (API origin with origin-verify header), bucket policy. `WebACLArn` empty (D-11 deferred). The secret is passed NoEcho and never echoed.
```bash
OV=$(aws ssm get-parameter --profile sentinelqa-admin --name /sentinelqa/stage/edge/origin-verify --with-decryption --query Parameter.Value --output text)
aws cloudformation deploy --profile sentinelqa-admin --stack-name SentinelQA-stage-Web --template-file $T/40-web.yaml \
  --parameter-overrides EnvName=stage OriginVerifySecret="$OV" WebACLArn="" \
  --role-arn "$EXEC" --tags app=SentinelQA env=stage --no-execute-changeset
unset OV
```
Verify: `aws cloudformation list-exports --profile sentinelqa-admin --query "Exports[?Name=='SentinelQA-stage-DistributionDomain'].Value" --output text` then `curl -s -o /dev/null -w '%{http_code}' https://<domain>/health` → 200.
Rollback: `aws cloudformation delete-stack --profile sentinelqa-admin --stack-name SentinelQA-stage-Web` (CloudFront deletion takes several minutes).

APPROVAL: Vishwas ____

## 8. `SentinelQA-stage-Observability` (50-observability, lean)
Creates CloudWatch alarms (records-api errors, API 5xx, Domain/Audit system errors, gate blocks) → stage alarm topic.
```bash
aws cloudformation deploy --profile sentinelqa-admin --stack-name SentinelQA-stage-Observability --template-file $T/50-observability.yaml \
  --parameter-overrides EnvName=stage EnvProfile=lean \
  --role-arn "$EXEC" --tags app=SentinelQA env=stage --no-execute-changeset
```
Verify: `aws cloudwatch describe-alarms --profile sentinelqa-admin --alarm-name-prefix SentinelQA-stage- --query "MetricAlarms[].[AlarmName,StateValue]" --output table`
Rollback: `aws cloudformation delete-stack --profile sentinelqa-admin --stack-name SentinelQA-stage-Observability`

APPROVAL: Vishwas ____

## 9. Smoke test and sample data
Smoke test per delivery-strategy §1a step 6 (health 200, 403 without origin header, 429 above 10 req/s, create without `isSample` → 422 `non_sample_data_forbidden`, QA-36 audit Deny check, first-deploy §5b). Then load data with `scripts/seed` only and run the `isSample=true` 100% count check (ci-and-data-guards §3.2).

APPROVAL (stage open for pipeline deploys): Vishwas ____

## 10. Teardown of the admin session
```bash
aws logout --profile sentinelqa-admin
# then delete the [profile sentinelqa-admin] block from ~/.aws/config (edit the file by hand)
grep -n sentinelqa-admin ~/.aws/config   # expect no output
```
APPROVAL (session closed): Vishwas ____

## OIDC trust (public repo)
- `00-account-oidc.yaml` creates only the provider (`token.actions.githubusercontent.com`, client ID `sts.amazonaws.com`); it has **no trust condition**.
- The trust lives on `DeployRole` in `00-bootstrap.yaml`: `StringEquals` on `aud = sts.amazonaws.com` and `sub = repo:${GitHubRepo}:environment:${EnvName}`. For stage that is exactly `repo:vishwasvr/SentinelQA:environment:stage`: no wildcards, no `pull_request`, no tag refs (ADR-0012). Each env's role trusts only its own env's `sub`.
- Consequence: deploy jobs must set `environment: stage` / `environment: prod`; a job without it (or a tag-triggered `ref:refs/tags/v*` run) gets a different `sub` and is refused.

## Cost
See [delivery-strategy.md §1b](../architecture/delivery-strategy.md#1b-cost-of-stage-repo-figures-only): stage alone is unpriced in the repo; dev + stage combined is quoted there. No new figures here.

## Run log
| Date (CT) | Run by | Steps | Result | Notes |
|---|---|---|---|---|
| | | | | |

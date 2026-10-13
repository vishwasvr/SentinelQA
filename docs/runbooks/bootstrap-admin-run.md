# Runbook: first bootstrap, admin run by Vishwas

Status: Draft. Agents never execute this. Vishwas runs it himself with **admin credentials** and approves each change set.

| | |
|---|---|
| Account / region | `723940054516` / `us-east-1` |
| Stacks | `SentinelQA-Account-OIDC` (once per account), then `SentinelQA-dev-Bootstrap` (stage/prod deferred until needed, Vishwas 2026-10-13) |
| Templates | `docs/architecture/iac/templates/00-account-oidc.yaml`, `00-bootstrap.yaml` |
| Params | `docs/architecture/iac/params/account.json`, `params/<env>.json` key `00-bootstrap` |

**Why admin:** the `sentinelqa-bootstrap` IAM user lacks `iam:ListOpenIDConnectProviders`, and it cannot create the deploy role, execution role or boundary. Only these two stacks are deployed by hand. Every later stack (10, 20, 30, 40, 50, and 25 for prod) goes through GitHub Actions OIDC, using the deploy role with `--role-arn` set to `SentinelQA-<env>-cfn-exec`. The deploy role is explicitly denied on the Bootstrap stack, so any later Bootstrap change is also an admin run.

Run all commands from the repo root in bash with `jq` installed.

## 1. Pre-checks
```bash
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
aws sts get-caller-identity
#   Account must be 723940054516; Arn must be an admin principal (e.g. AWSReservedSSO_AdministratorAccess_... or admin role) — NOT sentinelqa-bootstrap
aws configure get region      # or rely on AWS_REGION above; must be us-east-1

aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?ends_with(Arn,'oidc-provider/token.actions.githubusercontent.com')].Arn" --output text
#   prints an ARN  -> CreateOidcProvider=false (reuse it)
#   prints nothing -> CreateOidcProvider=true
# If an ARN is printed, also check: aws iam get-open-id-connect-provider --open-id-connect-provider-arn <arn>
#   ClientIDList must contain sts.amazonaws.com (add it with add-client-id-to-open-id-connect-provider if missing, with approval).

T=docs/architecture/iac/templates
aws cloudformation validate-template --template-body file://$T/00-account-oidc.yaml
aws cloudformation validate-template --template-body file://$T/00-bootstrap.yaml
```
- In GitHub, under `vishwasvr/SentinelQA` → Settings → Environments, confirm that `dev` exists (`stage` and `prod` must exist before their bootstraps). The prod environment needs the required reviewer Vishwas (see first-deploy.md §5).
- Edit `params/account.json` so that `CreateOidcProvider` matches the result of the check above.

## 2. Account OIDC stack (once per account)
```bash
CREATE=$(jq -r '.["00-account-oidc"].CreateOidcProvider' docs/architecture/iac/params/account.json)

aws cloudformation deploy --stack-name SentinelQA-Account-OIDC \
  --template-file $T/00-account-oidc.yaml \
  --parameter-overrides CreateOidcProvider=$CREATE \
  --tags app=SentinelQA \
  --no-execute-changeset
# copy the change set ARN printed, then:
aws cloudformation describe-change-set --change-set-name <CHANGE_SET_ARN> \
  --query "{Status:Status,Changes:Changes[].ResourceChange.{Action:Action,Type:ResourceType,Id:LogicalResourceId}}"
#   expect: 1 x Add AWS::IAM::OIDCProvider if CREATE=true; nothing if false (outputs only)
aws cloudformation execute-change-set --change-set-name <CHANGE_SET_ARN>
aws cloudformation wait stack-create-complete --stack-name SentinelQA-Account-OIDC
aws cloudformation update-termination-protection --enable-termination-protection --stack-name SentinelQA-Account-OIDC
```
No IAM capability is needed, because an OIDC provider is not an IAM role or policy.

## 3. Bootstrap for dev
```bash
ENV=dev
P=docs/architecture/iac/params/$ENV.json
OVR=$(jq -r '(.["00-bootstrap"] + {EnvName: .all.EnvName}) | to_entries | map("\(.key)=\(.value)") | join(" ")' $P)
echo "$OVR"   # EnvName=dev GitHubRepo=vishwasvr/SentinelQA OidcProviderArn=arn:aws:iam::723940054516:oidc-provider/...

aws cloudformation deploy --stack-name SentinelQA-$ENV-Bootstrap \
  --template-file $T/00-bootstrap.yaml \
  --parameter-overrides $OVR \
  --capabilities CAPABILITY_NAMED_IAM \
  --tags app=SentinelQA env=$ENV \
  --no-execute-changeset
aws cloudformation describe-change-set --change-set-name <CHANGE_SET_ARN> \
  --query "Changes[].ResourceChange.{Action:Action,Type:ResourceType,Id:LogicalResourceId}" --output table
#   expect 6 x Add (see §4); review, then:
aws cloudformation execute-change-set --change-set-name <CHANGE_SET_ARN>
aws cloudformation wait stack-create-complete --stack-name SentinelQA-$ENV-Bootstrap
```
For prod, after its change set has executed, also run:
`aws cloudformation update-termination-protection --enable-termination-protection --stack-name SentinelQA-prod-Bootstrap`
(Optional for dev and stage.)

## 4. What gets created
| Stack | Logical ID | Type | Name |
|---|---|---|---|
| Account-OIDC (only if `CreateOidcProvider=true`) | GitHubOidcProvider | AWS::IAM::OIDCProvider | `arn:aws:iam::723940054516:oidc-provider/token.actions.githubusercontent.com` (client ID `sts.amazonaws.com`, Retain) |
| `<env>`-Bootstrap | ArtifactBucket | AWS::S3::Bucket | `sentinelqa-<env>-artifacts-723940054516` (versioned, SSE-S3, block public access, Retain) |
| | ArtifactBucketPolicy | AWS::S3::BucketPolicy | TLS-only deny |
| | AppRoleBoundary | AWS::IAM::ManagedPolicy | `SentinelQA-<env>-app-boundary` |
| | CfnExecRole | AWS::IAM::Role | `SentinelQA-<env>-cfn-exec` |
| | DeployRole | AWS::IAM::Role | `SentinelQA-<env>-deploy` (GitHub OIDC trust) |

Exports: `SentinelQA-Account-GitHubOidcProviderArn`, `SentinelQA-<env>-CfnExecRoleArn`, `SentinelQA-<env>-AppRoleBoundaryArn`, `SentinelQA-<env>-ArtifactBucketName`.

## 5. Cost
- IAM roles, managed policies, the OIDC provider and CloudFormation itself: **free**.
- S3 artifact bucket: a few zips of a few MB per commit, plus 30-day noncurrent-version expiry. That comes to **a few cents per month** or less (storage about $0.023/GB-month, plus PUT/GET requests).
- KMS: **none**. The bucket uses SSE-S3 (AES256), with no customer-managed key and no KMS charges.

## 6. Post-checks
```bash
aws cloudformation describe-stacks --stack-name SentinelQA-Account-OIDC --query "Stacks[0].Outputs"
aws cloudformation describe-stacks --stack-name SentinelQA-$ENV-Bootstrap --query "Stacks[0].Outputs" --output table
aws iam get-role --role-name SentinelQA-$ENV-deploy --query Role.AssumeRolePolicyDocument
#   Federated = .../oidc-provider/token.actions.githubusercontent.com
#   aud = sts.amazonaws.com ; sub = repo:vishwasvr/SentinelQA:environment:<env>
aws iam get-role --role-name SentinelQA-$ENV-cfn-exec --query Role.AssumeRolePolicyDocument
#   Service = cloudformation.amazonaws.com, SourceAccount 723940054516
aws s3api get-bucket-versioning --bucket sentinelqa-$ENV-artifacts-723940054516      # Enabled
aws s3api get-public-access-block --bucket sentinelqa-$ENV-artifacts-723940054516    # all true
```
Then set the GitHub environment variable `AWS_ROLE_ARN` to the `DeployRoleArn` output. It is not a secret.

## 7. Rollback / delete
- **If a change set looks wrong:** `aws cloudformation delete-change-set --change-set-name <ARN>`. Nothing has been created at that point.
- **If creation failed:** CloudFormation rolls back automatically. Then run `aws cloudformation delete-stack --stack-name SentinelQA-$ENV-Bootstrap`.
- **Deleting a Bootstrap stack:** the artifact bucket is `Retain`, so it survives the stack delete. Remove it afterwards in this order:
  1. `aws cloudformation update-termination-protection --no-enable-termination-protection --stack-name SentinelQA-$ENV-Bootstrap` (only if protection was enabled).
  2. `aws cloudformation delete-stack --stack-name SentinelQA-$ENV-Bootstrap` and `wait stack-delete-complete`. Delete the env stacks 10–50 first, because they import its exports.
  3. Empty the versioned bucket: delete **all object versions and delete markers**, e.g.
     ```bash
     B=sentinelqa-$ENV-artifacts-723940054516
     aws s3api list-object-versions --bucket $B --output json \
       --query '{Objects: [Versions,DeleteMarkers][][].{Key:Key,VersionId:VersionId}}' > /tmp/del.json
     aws s3api delete-objects --bucket $B --delete file:///tmp/del.json   # repeat while >1000 objects
     aws s3api delete-bucket --bucket $B
     ```
- **The OIDC provider is retained.** Deleting `SentinelQA-Account-OIDC` (after disabling termination protection) leaves the provider in place. It is shared by every env, so delete it manually only if no env uses it any more: `aws iam delete-open-id-connect-provider --open-id-connect-provider-arn <arn>`. Deleting the dev stack never affects it.

## Run log

| Date (CT) | Run by | Stacks | Result | Notes |
|---|---|---|---|---|
| 2026-10-13 | Chief of Staff, with Vishwas's approval, using his temporary admin login (since logged out and deleted) | `SentinelQA-Account-OIDC` (`CreateOidcProvider=true`, termination protection on); `SentinelQA-dev-Bootstrap` | CREATE_COMPLETE (as reported by Chief of Staff; not independently verified by InfraDeploy) | `DeployRoleArn` = `arn:aws:iam::723940054516:role/SentinelQA-dev-deploy`. GitHub environment `dev` created with variable `AWS_ROLE_ARN`. `params/account.json` now sets `CreateOidcProvider` to `"true"` to match. Stage and prod bootstrap not yet run. |

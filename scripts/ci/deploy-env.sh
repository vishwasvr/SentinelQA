#!/usr/bin/env bash
# Deploy one environment from a prebuilt, immutable artifact (deploy.yml; delivery-strategy §3/§4, ADR-0012/0014/0017).
# Runs ONLY inside GitHub Actions with OIDC credentials. Never run locally.
# Inputs (env): DEPLOY_ENV (dev|stage), BUILD_SHA (40-hex), DIST_DIR (zips + manifest.json), ALARM_EMAIL,
#               NO_EXECUTE_STACKS (space-separated stack numbers to create a change set for but NOT execute).
set -euo pipefail

: "${DEPLOY_ENV:?}" "${BUILD_SHA:?}" "${DIST_DIR:?}"
case "$DEPLOY_ENV" in dev|stage) ;; *) echo "::error::Unsupported env '$DEPLOY_ENV'"; exit 1 ;; esac
[[ "$BUILD_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "::error::BUILD_SHA must be a full commit SHA"; exit 1; }
if [ -z "${ALARM_EMAIL:-}" ]; then
  echo "::error::vars.ALARM_EMAIL is empty for environment '$DEPLOY_ENV' (iac README, AlarmEmail contract)"; exit 1
fi

T=docs/architecture/iac/templates
P="docs/architecture/iac/params/${DEPLOY_ENV}.json"
REGION=us-east-1
STACKS="10-security 20-data 30-api 40-web 50-observability"   # no 25-backup outside prod
TAGS=(Project=SentinelQA "Environment=${DEPLOY_ENV}" ManagedBy=CloudFormation Repo=vishwasvr/SentinelQA)

out() { aws cloudformation describe-stacks --region "$REGION" --stack-name "SentinelQA-${DEPLOY_ENV}-Bootstrap" \
          --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
EXEC_ROLE=$(out CfnExecRoleArn)
BUCKET=$(out ArtifactBucketName)
[ -n "$EXEC_ROLE" ] && [ "$EXEC_ROLE" != None ] || { echo "::error::CfnExecRoleArn not found"; exit 1; }
[ -n "$BUCKET" ] && [ "$BUCKET" != None ] || { echo "::error::ArtifactBucketName not found"; exit 1; }

# 1. Upload zips under <sha>/ (immutable: never overwrite an existing key).
for fn in records-api reports-api; do
  key="${BUILD_SHA}/${fn}.zip"
  if aws s3api head-object --region "$REGION" --bucket "$BUCKET" --key "$key" >/dev/null 2>&1; then
    echo "s3://$BUCKET/$key already exists; not overwriting."
  else
    aws s3api put-object --region "$REGION" --bucket "$BUCKET" --key "$key" --body "${DIST_DIR}/${fn}.zip" --if-none-match '*' >/dev/null
  fi
done

declared_params() { awk '/^Parameters:/{p=1;next} /^[A-Za-z]+:/{p=0} p && /^  [A-Za-z0-9]+:/{sub(":","",$1);print $1}' "$1"; }
retain_ids() { awk '/^Resources:/{p=1;next} /^[A-Za-z]+:/{p=0} p && /^  [A-Za-z0-9]+:/{id=$1;sub(":","",id)} p && /DeletionPolicy: *Retain|UpdateReplacePolicy: *Retain/{print id}' "$1" | sort -u; }

for n in $STACKS; do
  tmpl="$T/${n}.yaml"
  name="${n#*-}"; name="$(tr '[:lower:]' '[:upper:]' <<<"${name:0:1}")${name:1}"
  stack="SentinelQA-${DEPLOY_ENV}-${name}"
  mapfile -t declared < <(declared_params "$tmpl")
  overrides=()
  # params/<env>.json: "all" + per-stack keys, only those the template declares; PIPELINE_SUPPLIED values are skipped.
  while IFS= read -r kv; do
    k="${kv%%=*}"
    if printf '%s\n' "${declared[@]}" | grep -qx "$k"; then overrides+=("$kv"); fi
  done < <(jq -r --arg s "$n" '(.all // {}) + (.[$s] // {}) | to_entries[]
             | select((.value|tostring|startswith("PIPELINE_SUPPLIED"))|not) | "\(.key)=\(.value)"' "$P")
  # Pipeline-supplied keys.
  case "$n" in
    10-security) overrides+=("AlarmEmail=$ALARM_EMAIL") ;;
    30-api) overrides+=("RecordsApiKey=${BUILD_SHA}/records-api.zip" "ReportsApiKey=${BUILD_SHA}/reports-api.zip") ;;
    40-web)
      OV=$(aws ssm get-parameter --region "$REGION" --name "/sentinelqa/${DEPLOY_ENV}/edge/origin-verify" \
             --with-decryption --query Parameter.Value --output text)
      echo "::add-mask::$OV"
      overrides+=("OriginVerifySecret=$OV") ;;
  esac

  echo "== $stack: creating change set"
  set +e
  log=$(aws cloudformation deploy --region "$REGION" --stack-name "$stack" --template-file "$tmpl" \
          --parameter-overrides "${overrides[@]}" --role-arn "$EXEC_ROLE" --capabilities CAPABILITY_NAMED_IAM \
          --tags "${TAGS[@]}" --no-execute-changeset --no-fail-on-empty-changeset 2>&1)
  rc=$?
  set -e
  [ -n "${OV:-}" ] && log="${log//$OV/***}"
  echo "$log"
  [ $rc -eq 0 ] || { echo "::error::change set creation failed for $stack"; exit $rc; }
  cs=$(grep -oE 'arn:aws:cloudformation:[^ ]+:changeSet/[^ ]+' <<<"$log" | head -1 || true)
  if [ -z "$cs" ]; then echo "$stack: no changes."; continue; fi

  # Fail if the change set replaces or deletes a Retain resource (ci-and-data-guards §1.3 step 3).
  retained=$(retain_ids "$tmpl")
  bad=$(aws cloudformation describe-change-set --region "$REGION" --change-set-name "$cs" --output json \
        | jq -r '.Changes[].ResourceChange | select(.Action=="Remove" or .Replacement=="True" or .Replacement=="Conditional") | .LogicalResourceId' \
        | grep -Fxf <(printf '%s\n' "$retained") || true)
  if [ -n "$bad" ] && [ -n "$retained" ]; then
    echo "::error::$stack change set replaces/deletes Retain resources: $bad (change set left for review: $cs)"; exit 1
  fi

  if [[ " ${NO_EXECUTE_STACKS:-} " == *" $n "* ]]; then
    echo "::warning::$stack change set NOT executed (needs Vishwas's explicit approval): $cs"; continue
  fi
  type=$(aws cloudformation describe-change-set --region "$REGION" --change-set-name "$cs" --query ChangeSetType --output text)
  aws cloudformation execute-change-set --region "$REGION" --change-set-name "$cs"
  if [ "$type" = CREATE ]; then w=stack-create-complete; else w=stack-update-complete; fi
  aws cloudformation wait "$w" --region "$REGION" --stack-name "$stack"
  echo "$stack: done."
done

# Record the deployed version (delivery-strategy §4). Non-fatal until the deploy role's SSM write permission is confirmed.
VERSION=$(jq -r .version "${DIST_DIR}/manifest.json")
aws ssm put-parameter --region "$REGION" --name "/sentinelqa/${DEPLOY_ENV}/version" --type String --overwrite \
  --value "$VERSION" >/dev/null || echo "::warning::could not write /sentinelqa/${DEPLOY_ENV}/version"

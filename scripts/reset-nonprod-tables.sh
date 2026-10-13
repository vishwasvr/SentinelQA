#!/usr/bin/env bash
# DRAFT - never executed. Full reset of SentinelQA dev/stage DynamoDB tables
# (BRD v1.2.3 BR-08/BR-46, decision C-1). See docs/runbooks/nonprod-table-reset.md.
# Usage: scripts/reset-nonprod-tables.sh <dev|stage> <expected-account-id>
# Run with the operator reset role (SentinelQA-<env>-table-reset), never the deploy role.
set -euo pipefail

ENV_NAME="${1:-}"; EXPECTED_ACCOUNT="${2:-}"
REGION="${AWS_REGION:-us-east-1}"
TABLES=(Domain AuditLog)

die() { echo "ERROR: $*" >&2; exit 1; }

# Guard 1: env parameter
case "$ENV_NAME" in
  dev|stage) ;;
  prod|PROD|Prod) die "refusing to reset prod" ;;
  *) die "usage: $0 <dev|stage> <expected-account-id>" ;;
esac
[[ "$EXPECTED_ACCOUNT" =~ ^[0-9]{12}$ ]] || die "expected-account-id must be 12 digits"

# Guard 2: account
ACTUAL_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
[[ "$ACTUAL_ACCOUNT" == "$EXPECTED_ACCOUNT" ]] || die "account mismatch: $ACTUAL_ACCOUNT != $EXPECTED_ACCOUNT"

STACK="SentinelQA-${ENV_NAME}-Data"
# Guard 3: stack tag / parameter must say this env, not prod
STACK_ENV="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Parameters[?ParameterKey=='EnvName'].ParameterValue | [0]" --output text)"
[[ "$STACK_ENV" == "$ENV_NAME" ]] || die "stack $STACK EnvName=$STACK_ENV, expected $ENV_NAME"

for t in "${TABLES[@]}"; do
  name="SentinelQA-${ENV_NAME}-${t}"
  arn="$(aws dynamodb describe-table --region "$REGION" --table-name "$name" --query Table.TableArn --output text)"
  tag_env="$(aws dynamodb list-tags-of-resource --region "$REGION" --resource-arn "$arn" \
    --query "Tags[?Key=='env'].Value | [0]" --output text)"
  [[ "$tag_env" == "$ENV_NAME" ]] || die "$name tag env=$tag_env, expected $ENV_NAME"
  [[ "$name" != *-prod-* ]] || die "prod table name detected: $name"
done

echo "About to DELETE ALL DATA in: ${TABLES[*]/#/SentinelQA-${ENV_NAME}-} (account $ACTUAL_ACCOUNT, $REGION)"
read -r -p "Type '${ENV_NAME}-RESET' to continue: " answer
[[ "$answer" == "${ENV_NAME}-RESET" ]] || die "not confirmed"

for t in "${TABLES[@]}"; do
  name="SentinelQA-${ENV_NAME}-${t}"
  echo "Deleting $name"
  aws dynamodb delete-table --region "$REGION" --table-name "$name" >/dev/null
  aws dynamodb wait table-not-exists --region "$REGION" --table-name "$name"
done

echo "Re-creating tables via stack update (deploy pipeline / change set on $STACK with the CFN exec role)."
echo "Then re-seed reference data if required. Record the reset in the ops log."

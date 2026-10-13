# Runbook: non-prod DynamoDB table reset (dev/stage)

| | |
|---|---|
| Status | Draft (not yet exercised) |
| Scope | `SentinelQA-dev-*` and `SentinelQA-stage-*` tables `Domain` and `AuditLog` only |
| Source | BRD v1.2.3 BR-08 / BR-46, decision C-1 (Vishwas, 2026-10-13), ADR-0006, D-05 |
| Resolves | infra-review M-7 and m-9 (reset procedure) |
| Script | [`scripts/reset-nonprod-tables.sh`](../../scripts/reset-nonprod-tables.sh) (draft, never executed) |

Architect will link this runbook from ADR-0006.

## 1. When to use it
BR-46 keeps the audit log append-only in every environment as application behavior. Single-event updates and deletes are always denied. In **dev/stage only**, an admin may perform a **full table reset**, which is allowed because those environments hold synthetic data only (BR-45). A reset deletes all items in both tables. It never runs on single events, and **never on prod**. Prod stays strictly append-only.

Typical triggers are corrupt synthetic data, a key-schema change that forces replacement (M-7), or a test-suite reset.

## 2. Method: DeleteTable + stack update
The tables have fixed names and `DeletionPolicy: Retain` (20-data, M-7). That means:
1. The operator deletes the two tables with the script. Deletion goes through the `DeleteTable` API; the script does not scan and delete items.
2. The operator re-creates them by running a normal change set on `SentinelQA-<env>-Data` through the pipeline (deploy role → `SentinelQA-<env>-cfn-exec`). CFN detects drift-deleted resources only on update, so if the change set shows no changes, add or bump a harmless table tag such as `reset=<date>` to force an update, or import the tables.
3. Optional: re-seed the synthetic data.

Item-by-item deletion is not used. The app's roles and the permissions boundary deny `DeleteItem/BatchWriteItem`, and a full reset is cleaner.

## 3. Prod guards (defense in depth)
| Layer | Guard |
|---|---|
| Script: env param | Refuses anything except `dev`/`stage`; refuses `prod` explicitly |
| Script: account | `sts get-caller-identity` must equal the account ID passed as argument 2 |
| Script: stack | `SentinelQA-<env>-Data` stack parameter `EnvName` must equal the requested env |
| Script: tags/name | Each table's `env` tag must equal the requested env; any `-prod-` name aborts |
| Script: human | Interactive confirmation: type `<env>-RESET` |
| IAM | Reset principal has an **explicit Deny** on prod tables (below); explicit deny wins over any Allow |
| AWS | Prod tables have deletion protection enabled (20-data strict) |

## 4. Reset principal (IAM)
Use a dedicated operator role `SentinelQA-<env>-table-reset`, assumed by named admins with MFA. Never use the GitHub deploy role or the CFN exec role (dev/stage only; the CFN exec role in prod denies `DeleteTable`). The role is not yet in a template. Open item: add it to 00-bootstrap for dev/stage only, or create it as a manual operator role.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowNonProdTableReset",
      "Effect": "Allow",
      "Action": ["dynamodb:DescribeTable", "dynamodb:ListTagsOfResource", "dynamodb:DeleteTable"],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/SentinelQA-dev-*",
        "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/SentinelQA-stage-*"
      ]
    },
    {
      "Sid": "AllowGuardReads",
      "Effect": "Allow",
      "Action": ["cloudformation:DescribeStacks", "sts:GetCallerIdentity"],
      "Resource": "*"
    },
    {
      "Sid": "DenyAnyProdTableWrite",
      "Effect": "Deny",
      "Action": ["dynamodb:DeleteTable", "dynamodb:DeleteItem", "dynamodb:BatchWriteItem", "dynamodb:UpdateItem", "dynamodb:PutItem", "dynamodb:UpdateTable", "dynamodb:RestoreTableToPointInTime"],
      "Resource": "arn:aws:dynamodb:*:*:table/SentinelQA-prod-*"
    },
    {
      "Sid": "DenyProdTaggedTables",
      "Effect": "Deny",
      "Action": "dynamodb:*",
      "Resource": "*",
      "Condition": { "StringEquals": { "aws:ResourceTag/env": "prod" } }
    }
  ]
}
```

## 5. Procedure
1. Announce the reset in the team channel (env, time, reason).
2. Assume `SentinelQA-<env>-table-reset` (MFA).
3. Run `scripts/reset-nonprod-tables.sh <dev|stage> <account-id>` and confirm with `<env>-RESET`.
4. Run the `SentinelQA-<env>-Data` change set through the pipeline to re-create the tables, then check that both tables are `ACTIVE`.
5. Smoke test: the app health check plus one record create to confirm the audit event is appended.
6. Record the date, operator, env and reason in the ops log.

## 6. Rollback
No rollback is possible, and none is needed: dev/stage data is synthetic (BR-45). If the re-create fails, fix the change set and redeploy. Lean profile has PITR off, so there is no restore.

# Audit write path spec (QA-28, QA-26 and QA-31 tests). Developer, 2026-10-13. Spec only; no code yet.

## 1. Single write path
- All audit events go through one module, `src/shared/audit/appendAudit.ts`. It exports `buildAuditPut(event, ctx)`, which returns a `TransactWriteItems` Put entry, and nothing else.
- The Put always sets `ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)`. SK is `<isoTs>#<ULID>`, so it's unique. The condition is a constant inside the module, and callers can't override it.
- Every domain write (create, update, transition, soft-delete) sends one `TransactWriteItems` containing the Domain item and the audit Put. If either fails, nothing is written.
- The audit snapshot follows ADR-0006 and overview §4.3: it holds only the changed fields, gzip-compressed into `snapshotGz`, with a 350 KB cap per item.
- **Enforcement in code:**
  - An ESLint `no-restricted-imports` / `no-restricted-syntax` rule fails CI if any file outside `src/shared/audit/` refers to `AUDIT_TABLE` or builds a Put/Update/Delete for it.
  - A CI grep check backs the lint rule up.
  - The ESLint rule is part of the `ci.yml` lint stage (`ci-and-data-guards.md`, QA-32).
- No code path ever calls UpdateItem, DeleteItem or BatchWriteItem on the AuditLog table.

## 2. IAM tightening: can PutItem be restricted to attribute_not_exists?
**Not possible.** IAM has no condition key that can see a request's `ConditionExpression`. The only DynamoDB condition keys are `dynamodb:LeadingKeys`, `dynamodb:Attributes`, `dynamodb:Select`, `dynamodb:ReturnValues`, `dynamodb:ReturnConsumedCapacity` and `dynamodb:EnclosingOperation`. DynamoDB resource-based policies use the same keys, so they can't do it either. A policy can't tell a conditional put from an unconditional one.

**What we do instead** (proposed changes to `30-api.yaml`, waiting on Architect/Vishwas):
1. Keep the AuditLog grant at `dynamodb:PutItem` only. It's already like that: no UpdateItem, DeleteItem or BatchWriteItem.
2. Add an explicit `Deny` on the AuditLog table ARN for `UpdateItem`, `DeleteItem`, `BatchWriteItem` and `PartiQLUpdate/PartiQLDelete/PartiQLInsert`, so a later edit that adds an Allow can't open them up.
3. Add a Deny on PutItem for the AuditLog table when it doesn't come from a transaction:
   - Condition: `StringNotEquals dynamodb:EnclosingOperation TransactWriteItems`.
   - Effect: the only way to write an audit item is through a transaction.
   - Before relying on it, confirm that the `EnclosingOperation` key is filled in for PutItem inside `TransactWriteItems`. This is checked in the dev smoke test, alongside #26.
4. What's left after this: an attacker who can run code in the role could still send an unconditional Put inside a transaction. That's covered by:
   - the single write path and its lint rule,
   - the integration test in §3,
   - PITR and the export retention (2557 days, delete-deny, `53b8ae8`), which can rebuild any overwritten entry.

## 3. Tests (run on DynamoDB Local in the `ci.yml` integration stage)
**QA-28 (audit overwrite):**
- **Overwrite fails:** write an audit event, then send a second Put with the same PK/SK through `buildAuditPut`. Expect `TransactionCanceledException` with reason `ConditionalCheckFailed`. The original item stays byte-identical, and the Domain item from the second transaction isn't written.
- **Callers can't drop the condition:** call `buildAuditPut` with a ctx that tries to override the condition. The returned entry still carries the constant condition.
- **No other path:** a static test (the lint fixture) shows that a file writing `AUDIT_TABLE` outside the module fails lint.
- **Atomicity:** force the Domain condition to fail. Expect no audit item to be written.

**QA-26 (item size):**
- A Domain or audit item of 349 KB passes.
- One of 351 KB gets 413 `item_too_large`.
- After a 413, neither the Domain item nor the audit item exists.

**QA-31 (config failure handling, overview §4.2), as unit tests with a mocked SSM:**
- A good value is cached for 5 minutes. If a refresh fails, the last good value is used.
- If the origin secret is missing or malformed, the request fails closed with a 403.
- If the markers or CFR ranges are missing or malformed, free-text writes get 503 `config_unavailable` and reads still work. The gate never runs with an empty list.
- Bad thresholds, due-days or timezone values return 503 only on the routes that use them:
  - weights that don't sum to 1 ±0.001,
  - bands that aren't sorted,
  - a day count that isn't a positive integer,
  - an invalid IANA zone.
- Logs contain the parameter name but never its value, and the `ConfigErrors` metric is emitted.

**Marker test cases carried forward:** `I.T.A.R`, `C-U-I` and `15 C.F.R. 734` get added to `test_marker_patterns.py` when the build starts.

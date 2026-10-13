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

## 4. Additions (2026-10-13, after Vishwas's BR-49 decision and QA-36/40)
- **isSample tests (BR-49/US-43, `30a1d00`, `28e42a1`):**
  - In prod, a create with `isSample=true` returns 422 `sample_flag_forbidden_in_prod`.
  - In dev and stage, a create without `isSample=true` returns 422 `non_sample_data_forbidden`.
  - A PATCH that changes `isSample` returns 422 `sample_flag_immutable`, and a PATCH with the same value does nothing.
  - In every 422 case, neither the Domain item nor the audit item is written.
- **QA-36:** the #26 smoke test checks the transaction-only Deny (`first-deploy.md` §5b):
  - a write inside a transaction must succeed,
  - a bare PutItem must be denied.
  
  If the transactional write gets denied, remove only that Deny. The conditional put, the lint rule and the other Denies still apply.

## 5. OQ decisions (2026-10-13, Vishwas; Architect `6a8f805`, `968695f`)
Docs only. These tests get written once building opens.
- **OQ-15 Assign training:** `POST /api/quality-records/{id}/training` and `POST /api/po-checks/{id}/training`.
  - Each writes the training item (with the source record's ID and type) and its audit entry in one transaction. If the transaction fails, neither item is written.
  - An unknown source record returns 404, and nothing is written.
  - No training is created automatically by any other route. A regression test checks this.
- **OQ-23 Issue SCAR:** `POST /api/quality-records/{id}/scar`.
  - This only works on NCMR and CAPA records. Any other record type returns 422.
  - The SCAR links both the source record and the supplier. The SCAR and its audit entry go in one transaction.
- **OQ-14 supplier warning:** `supplierId` on a PO is optional. `supplierApprovalWarning` is true only when the linked supplier has no Active qualification on the ASL.
  - Tests cover:
    - no supplier linked, which gives no warning,
    - a supplier with an Active qualification, which gives no warning,
    - a supplier with no Active qualification, which gives a warning.
  - The warning is worked out when the PO is read and is never stored.
  - A PO is never blocked from saving because of the warning.
- **OQ-10, 18, 21 and 22, and /compare:** these are browser-app only, with no API tests.
  - The UI tests check that the Records page shows sample records with a label, and that the print view has the header and the 'Uncontrolled when printed' footer.
  - They also check that the Industry filter is hidden and that /compare row 1 says 'Not in this build'.

## 6. Final decisions (2026-10-13, Vishwas; Architect `e444435`, BA `5857ec5`)
- **O-06 / BR-56 'Coming later' modules:** Ask the agent and Agent reliability.
  - The UI test checks that both stay in the navigation and each opens the 'Coming later' page.
  - The API test checks that there is no `/api/ai/*` route (404).
- **Issue SCAR placement:**
  - The UI test checks that the button is in the NCMR/CAPA action bar next to the stage-advance button, and that it's hidden when the record is Closed.
  - The button opens a form with supplier and title, and the new SCAR shows as a linked record.
  - The API test checks that `POST /api/quality-records/{id}/scar` on a Closed source record returns 422, with no SCAR and no audit entry written.
- **O-03 separate prod account:** this needs no spec change. The tests don't depend on which account they run in, and the per-environment config still comes from SSM.

## 7. QA-41 to QA-44 (2026-10-13; Architect `06820a8`, InfraDeploy `3cb4c6a`/`9e5fbd1`)
- **QA-41/42 error codes:** the tests check each error code exactly as listed in openapi:
  - 413 `item_too_large`
  - 503 `config_unavailable`
  - 422 `non_sample_data_forbidden`, `sample_flag_forbidden_in_prod` and `sample_flag_immutable`
  - 422 `scar_source_invalid`, for a SCAR or Closed source record (this replaces the generic 422 in §5 and §6)
  - 422 `training_source_invalid`, for a SCAR source record

  A contract test checks every documented response against the openapi schema.
- **QA-43 browser app:**
  - There's no UI control for the sample flag.
  - In dev and stage, a build-config flag makes the API client add `isSample: true` to every create.
  - The prod build never sends the field.
  - Tests:
    - a dev build's create request body includes `isSample: true`,
    - a prod build's request body has no `isSample` key,
    - the UI shows no sample control in any environment.
- **QA-44 seed (mirrors Guard 1):**
  - `scripts/seed` runs every free-text fixture field through the same controlled-data gate function the API uses, with that environment's marker lists, before any write.
  - If anything matches, the run stops with nothing written. The log shows only the file, record id and marker id, never the matched text.
  - No environment skips the check.
  - In prod, a run without an approval reference is refused before any write.
  - Each prod run writes one record to the CloudWatch Logs group `/sentinelqa/prod/seed-runs`. It holds who ran it, the commit, the fixtures, the counts, the approval reference, the times and the outcome. It never holds record bodies or credentials.
  - Tests:
    - a fixture containing a marker is stopped with zero writes,
    - the log contains no matched text,
    - a prod run without an approval reference is refused,
    - the run-record fields are checked against the list above.

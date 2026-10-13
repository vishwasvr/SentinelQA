# Module spec: audit write path (`src/shared/audit/`)

Describes the behavior implemented in `src/shared/audit/appendAudit.ts` (PR #7). The design and test plan are in [audit-write-path.md](audit-write-path.md) (§1 single write path, §3 tests); this page does not repeat them.

## Purpose
The single, append-only way to write audit events, atomically with the Domain write.

## Inputs and outputs
- `buildAuditPut(event, ctx): TransactWriteItem`: Put with constant `attribute_not_exists(PK) AND attribute_not_exists(SK)`; PK `WS#<ws>#ENT#<id>`, SK `<isoTs>#<ULID>`; snapshot gzip JSON in `snapshotGz`; table from `ctx` or `AUDIT_TABLE`.
- `appendAudit(sender, domainWrites, event, ctx)`: one `TransactWriteItems` with the Domain write(s) plus the audit Put; `ClientRequestToken` = Idempotency-Key.
- `ulid(now?, rand?)`: 26-char, time-first, sortable. Types `AuditEvent`, `AuditEventType` (`CREATED|UPDATED|TRANSITIONED|DELETED|REVERSED`), `AuditCtx`, `TransactSender`.

## Validation and errors
| Condition | HTTP | Code |
|---|---|---|
| Audit item or any Domain Put over 350 KB | 413 | `item_too_large` (`{ field, bytes, entityType }`); nothing is sent |
| `AUDIT_TABLE` unset | internal `Error` | n/a |
| Empty Domain write list | internal `Error` | n/a |
| Overwrite / Domain condition fails | DynamoDB `TransactionCanceledException` propagates; nothing written |

### Invariants
- Callers cannot drop or override the condition expression.
- Audit and Domain writes commit together or not at all.
- Only this module refers to `AUDIT_TABLE` (enforced by `npm run audit-lint`).

## Requirement IDs covered
- [audit-write-path.md §1](audit-write-path.md#1-single-write-path) (QA-28), [§3](audit-write-path.md#3-tests-run-on-dynamodb-local-in-the-ciyml-integration-stage); BR-46 (append-only); ADR-0006.
- [Architecture overview §4.3](../architecture/architecture-overview.md#43-item-size-limit-for-records-and-audit-snapshots-architecture-rule-qa-26) (QA-26, 350 KB cap).

## Test approach
`tests/shared/audit.test.ts` (Put shape, condition fixed, optional fields, defaults, 413, ulid, one transaction + token, overwrite fails byte-identical, atomicity, 349/351 KB, Update writes, empty list); `tests/ci/audit-lint.test.ts`.

### Coverage
Safety-critical: **100% lines and branches** for `src/shared/audit/`.

## Ambiguity calls

All 7 calls from the PR #7 description, accepted by Architect and BusinessAnalyst ("this module" marks the ones that apply here):
1. `appendAudit.ts` exports `appendAudit`, `ulid` and types besides `buildAuditPut` (spec said "and nothing else"). **(this module)**
2. DP-03 separators: both joined (`I.T.A.R` -> `itar`) and spaced (`export-controlled` -> `export controlled`) readings are screened.
3. Whole-word `EAR` also blocks the plain word "ear"; the BRD only excludes "year".
4. `isSample` must be the boolean `true`; the string `"true"` is rejected; prod stores `false` when absent or false.
5. A "malformed" origin secret is a value under 16 characters (no schema given).
6. The "15 C.F.R. 734" case already passes in `test_marker_patterns.py`; that file was not edited.
7. A failed refresh that falls back to the last good value is still logged and counted as a ConfigError.

## Known limitations
- Tests use a mocked in-memory TransactWriteItems; the DynamoDB Local integration stage is still to be added.

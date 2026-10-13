# Module spec: isSample checks (`src/shared/sample/`)

Describes the behavior implemented in `src/shared/sample/isSample.ts` (PR #7). Code and tests win over this text.

## Purpose
Keeps sample data and real data apart: dev/stage accept only sample records, prod rejects the sample flag, and the flag can never change after create.

## Inputs and outputs
- `checkCreateSample(env: 'dev'|'stage'|'prod', body: { isSample?: unknown }): boolean`: returns the value to store.
- `checkPatchSample(stored: boolean, patch): Omit<patch, 'isSample'>`: returns the patch with `isSample` removed.

## Validation and errors
| Condition | HTTP | Code |
|---|---|---|
| Create in dev/stage, `isSample !== true` (false, missing, or non-boolean) | 422 | `non_sample_data_forbidden` |
| Create in prod, `isSample === true` | 422 | `sample_flag_forbidden_in_prod` |
| PATCH in any env with `isSample` present and different from stored | 422 | `sample_flag_immutable` |

### Invariants
- Prod create stores `false` (field absent or `false`); dev/stage create stores `true`.
- PATCH never writes `isSample`; re-sending the stored value is a no-op and is stripped.
- On a 422, nothing is saved and no audit event is appended (the caller throws before the write).

## Requirement IDs covered
- **BR-49** (isSample decided; immutable, v1.6.3), with BR-31, BR-45, US-43.
- [audit-write-path.md §4](audit-write-path.md#4-additions-2026-10-13-after-vishwass-br-49-decision-and-qa-3640) (the full rule text; not repeated here).

## Test approach
`tests/shared/sample.test.ts`: create per env (true/false/missing/string), stored value returned; PATCH per env: change -> 422, same value stripped, no flag in patch.

### Coverage
Safety-critical: **100% lines and branches** for `src/shared/sample/`.

## Ambiguity calls

All 7 calls from the PR #7 description, accepted by Architect and BusinessAnalyst ("this module" marks the ones that apply here):
1. `appendAudit.ts` exports `appendAudit`, `ulid` and types besides `buildAuditPut` (spec said "and nothing else").
2. DP-03 separators: both joined (`I.T.A.R` -> `itar`) and spaced (`export-controlled` -> `export controlled`) readings are screened.
3. Whole-word `EAR` also blocks the plain word "ear"; the BRD only excludes "year".
4. `isSample` must be the boolean `true`; the string `"true"` is rejected; prod stores `false` when absent or false. **(this module)**
5. A "malformed" origin secret is a value under 16 characters (no schema given).
6. The "15 C.F.R. 734" case already passes in `test_marker_patterns.py`; that file was not edited.
7. A failed refresh that falls back to the last good value is still logged and counted as a ConfigError.

## Known limitations
- In prod, a non-boolean truthy value (e.g. `"true"`) is not rejected; it is ignored and `false` is stored.

# Module spec: runtime config loader (`src/shared/config/`)

Describes the behavior implemented in `src/shared/config/configLoader.ts` (PR #7). Code and tests win over this text.

## Purpose
One loader for every `/sentinelqa/<env>/<name>` SSM parameter: validates, caches for 5 minutes, keeps the last good value if a refresh fails, and fails closed.

## Inputs and outputs
- `class ConfigLoader(deps: LoaderDeps)`; `get(name)`; `gateConfig()` returns `{ markers, cfrRanges }`.
- `LoaderDeps { ssm, env, now?, log?, metric? }` (SSM client is injected; tests mock it).
- `PARSERS`, `isValidTimeZone(tz)`, `CACHE_TTL_MS = 300000`, types `ConfigName`, `ConfigValues`.

## Validation and errors
| Condition | HTTP | Code |
|---|---|---|
| Missing or malformed, no cached value | 503 | `config_unavailable` |
| Same, for `edge/origin-verify` | 403 | `forbidden_origin` |

### Parameters and validation
| Name | Rule |
|---|---|
| `edge/origin-verify` | trimmed length >= 16. Operational guidance: origin-verify secrets should be at least 32 random characters (guidance, not a validation rule). |
| `controlled-data/markers` | comma list, no empty entries |
| `controlled-data/cfr-ranges` | non-empty JSON array of `{title, partFrom, partTo}` positive integers, `partFrom <= partTo` |
| `supplier-risk/weights` | weights non-negative numbers summing to 1 ±0.001; bands non-empty, `min` strictly ascending |
| `due-soon-days` | `calibration`, `training`, `supplierReeval` positive integers |
| `capa-ncmr/default-due-days` | `{ days }` positive integer |
| `workspace/timezone` | valid IANA name |

### Invariants
- Fetched with `WithDecryption: true`; cache is per parameter for 5 minutes.
- A failed refresh with a cached value returns the last good value (no error to the caller).
- Every failure calls `log({ level: 'ERROR', errorCode: 'config_unavailable', parameter, reason: 'missing'|'malformed' })` and `metric('ConfigErrors', { Env })`. Values are never logged.

## Requirement IDs covered
- [Architecture overview §4.2](../architecture/architecture-overview.md#42-runtime-config-caching-and-failure-handling-architecture-rule-qa-31) (QA-31) and [audit-write-path.md §3](audit-write-path.md#3-tests-run-on-dynamodb-local-in-the-ciyml-integration-stage) QA-31 tests.
- Configurable values per BR-47 (supplier risk weights/bands, due-soon days); gate lists for BR-44 ([gate.md](gate.md)); ADR-0015 origin-verify header.

## Test approach
`tests/shared/config.test.ts`: every good value, 5-minute cache then refresh, last good on failed refresh, missing/malformed per parameter (503/403), weights ±0.001, missing without hooks, `isValidTimeZone`.

### Coverage
Safety-critical: **100% lines and branches** for `src/shared/config/`.

## Ambiguity calls

All 7 calls from the PR #7 description, accepted by Architect and BusinessAnalyst ("this module" marks the ones that apply here):
1. `appendAudit.ts` exports `appendAudit`, `ulid` and types besides `buildAuditPut` (spec said "and nothing else").
2. DP-03 separators: both joined (`I.T.A.R` -> `itar`) and spaced (`export-controlled` -> `export controlled`) readings are screened.
3. Whole-word `EAR` also blocks the plain word "ear"; the BRD only excludes "year".
4. A non-boolean `isSample` (e.g. the string `"true"`) is rejected in dev/stage (422 `non_sample_data_forbidden`) and ignored in prod (stored as `false`). The prod handling is a design choice (ambiguity call), not required by BR-49, which defines only: boolean `true` in prod -> 422 `sample_flag_forbidden_in_prod`, missing -> `false`, changing the flag -> 422 `sample_flag_immutable`.
5. A "malformed" origin secret is a value under 16 characters (no schema given). **(this module)** Operational guidance: origin-verify secrets should be at least 32 random characters (guidance, not a validation rule).
6. The "15 C.F.R. 734" case already passes in `test_marker_patterns.py`; that file was not edited.
7. A failed refresh that falls back to the last good value is still logged and counted as a ConfigError. **(this module)**

## Known limitations
- In v1 the last good value has **no maximum age**: a long SSM outage keeps serving the old value. Such an outage is detected through the `ConfigErrors` alarm (every failed refresh is logged and emits the `ConfigErrors` metric, call 7), not by the loader expiring the value.
- No AWS calls in tests; SSM is mocked.

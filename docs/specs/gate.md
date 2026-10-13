# Module spec: controlled-data gate (`src/shared/gate/`)

Describes the behavior implemented in `src/shared/gate/controlledDataGate.ts` (PR #7). Code and tests win over this text; update both together.

## Purpose
Blocks free-text saves that lack the controlled-data attestation or that contain a configured controlled-data marker (keyword or CFR citation range), before anything is persisted or audited.

## Inputs and outputs
- `normalise(text): string`: NFKC, lower-case, collapse whitespace, trim.
- `findMarker(text, cfg: GateConfig): MarkerId | null`: first hit. Keywords are checked first in list order (`K<n>`, 1-based), then CFR ranges (`R<n>`, 1-based). Throws `Error('gate config is empty')` if either list is empty.
- `screenFreeText(fields, attestation, cfg): void`: screens every non-empty string field.
- Types: `GateConfig { markers: string[]; cfrRanges: CfrRange[] }`, `CfrRange { title; partFrom; partTo }`, `MarkerId`.

## Validation and errors
| Condition | HTTP | Code | Body detail |
|---|---|---|---|
| Non-empty free text and `attestation !== true` | 400 | `gate:attestation_required` | none |
| Marker or CFR range hit | 422 | `gate:controlled_marker` | `{ markerId }` only |
| Empty marker or CFR list | (internal `Error`) | n/a | the gate never runs with an empty list; the config loader returns 503 first |

### Behavior and invariants
- If no field has non-empty text, nothing is checked (no attestation needed).
- Attestation must be the boolean `true`.
- Keywords match whole-word (no letter/digit on either side, Unicode-aware), case-insensitive, after normalisation.
- DP-03 separators: each text is screened in three variants: as-is, joined (`I.T.A.R` -> `itar`) and spaced (`export-controlled` -> `export controlled`). Separators between digits are not touched (`22 CFR 1-20` does not hit; `22 CFR 120-130` hits on part 120).
- CFR citations use the same regex shape as `iac/tools/test_marker_patterns.py`: `<title> C.F.R. [Part|Parts|§] <part>[.<sub>]`, title 1-2 digits, part 1-4 digits; hit when title matches and `partFrom <= part <= partTo`.
- The matched text is never returned or logged; only the marker id.

## Requirement IDs covered
- **BR-44**: controlled-data gate on all free-text saves (attestation required; marker hit rejected). Also US-02, US-15, US-42.
- **DP-03**: normalisation (NFKC, case-fold, whitespace collapse; `.`/`-`/`_` between letters are separators); 422 names the marker id only.
- ADR-0005, [architecture overview §4 step 2](../architecture/architecture-overview.md#4-data-flow-and-api-conventions-current-build).
- Marker lists come from runtime config ([config.md](config.md)).

## Test approach
`tests/shared/gate.test.ts`: keyword/case/whole-word cases, DP-03 variants, CFR exhaustive parts 100..999, digit-separator follow-up, empty-config throw, `normalise`, `screenFreeText` 400/422/no-text/clean (`year 2026`).

### Coverage
Safety-critical: **100% lines and 100% branches** required for `src/shared/gate/` (`ci/coverage-policy.json`, `unit-coverage` job).

## Ambiguity calls

All 7 calls from the PR #7 description, accepted by Architect and BusinessAnalyst ("this module" marks the ones that apply here):
1. `appendAudit.ts` exports `appendAudit`, `ulid` and types besides `buildAuditPut` (spec said "and nothing else").
2. DP-03 separators: both joined (`I.T.A.R` -> `itar`) and spaced (`export-controlled` -> `export controlled`) readings are screened. **(this module)**
3. Whole-word `EAR` also blocks the plain word "ear"; the BRD only excludes "year". **(this module)**
4. A non-boolean `isSample` (e.g. the string `"true"`) is rejected in dev/stage (422 `non_sample_data_forbidden`) and ignored in prod (stored as `false`). The prod handling is a design choice (ambiguity call), not required by BR-49, which defines only: boolean `true` in prod -> 422 `sample_flag_forbidden_in_prod`, missing -> `false`, changing the flag -> 422 `sample_flag_immutable`.
5. A "malformed" origin secret is a value under 16 characters (no schema given).
6. The "15 C.F.R. 734" case already passes in `test_marker_patterns.py`; that file was not edited. **(this module)**
7. A failed refresh that falls back to the last good value is still logged and counted as a ConfigError.

## Known limitations
- **False positive:** the `EAR` keyword blocks the plain English word "ear" (any case). Accepted per BA / BRD v1.7.2; changing it needs Vishwas's decision.
- First hit only; later markers in the same text are not reported.

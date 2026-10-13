# QA / Testability Review — SentinelQA

| Item | Value |
|---|---|
| Reviewer | QA |
| Date | 2026-10-13 |
| Inputs | `docs/requirements/BRD.md` v1.2.2 (HEAD 9836af2), `docs/architecture/architecture-overview.md` v0.4, `docs/architecture/adr/0000–0013`, `docs/architecture/iac/` (README, params, templates 00–50) |
| Scope note | Per BRD §12, all AI generate/draft flows are deferred. AI-tagged rules (BR-01/02/03/21/29/30/43; US-01/05/07/22/24/32/33/39) are **excluded** from the test scope except for checking that the deferral itself holds (no `/api/ai/*` route, hidden/static pages, reserved fields default to `aiAssisted:false`). |
| Repo state | Docs and IaC skeleton only. The repo has **no application code, no tests, and no `.github/workflows`**. The IaC README says "skeleton only, never deployed", and `validate-template` was never run. Everything below is test design. Nothing has been executed. |

Severity: **blocker** = can't write a pass/fail test, or a gating control can't be verified. **major** = a significant gap or ambiguity that will cause rework or escaped defects. **minor** = clarity or consistency issue.

---

## 1. Acceptance-criteria testability

| ID | Finding | Ref | Sev | Owner |
|---|---|---|---|---|
| QA-01 | BR-47 values are all TBD. In `20-data.yaml`, `/supplier-risk/weights` = `{"TODO":…}` and `/due-soon-days` = `{"calibration":"TODO",…}`. Without numbers and a JSON schema we can't write expected outputs for BR-16 scoring, BR-18 buckets, BR-25 status or training status, and the deterministic score has no oracle. | BR-16/18/25/47, O-04 | blocker | BusinessAnalyst |
| QA-02 | BR-44 says "every endpoint that persists free text", but no document lists those endpoints or fields. The only API detail is a `POST /api/quality-records` example (overview §4), while `30-api.yaml` routes `ANY /api/records/{proxy+}` ("TODO: explicit routes"). We can't prove coverage of "every" without an enumerated endpoint/field inventory (API contract/OpenAPI). | BR-44, overview §4, 30-api | blocker | Architect |
| QA-03 | The marker-matching semantics are undefined: case sensitivity, word boundaries, substring vs token, Unicode/whitespace normalisation, multi-word phrases. The SSM list includes `ITAR`, `CUI` and `EAR99`. Naive substring matching on short markers (e.g. "CUI" inside "circuit") gives false positives. The superseded ADR-0005 list also included `EAR`, `22 CFR 12x` and `15 CFR 7xx`, which the SSM list dropped. Was that intended? | BR-44, ADR-0005, 20-data | blocker | BusinessAnalyst (list) / Architect (algorithm) |
| QA-04 | US-02 and US-15 ACs still describe only the UI checkbox. There is no Given/When/Then for the build rules: the 400 on missing attestation, the 422 on marker hit, the user-facing message on 422 (ADR-0005: "need clear messaging"), and whether the form keeps the user's input. | US-02, US-15, BR-04/05 | major | BusinessAnalyst |
| QA-05 | The error contract is unspecified: response body shape, error code and returned marker id for 400/422, the order of checks (attestation before markers? before domain validation?), and the behaviour when a request is both missing attestation and contains a marker. | BR-44, overview §4 | major | Architect |
| QA-06 | US-08 hard-codes "8", and BR-42 defines the count via due-soon items whose thresholds are TBD (QA-01). Restate the AC as a formula ("count = number of items with status Overdue or Due soon across training, calibration and supplier re-eval") with expected values per synthetic dataset. | US-08, BR-42 | major | BusinessAnalyst |
| QA-07 | "Independent" approver (BR-10/US-16) and "author" (US-30/BR-20 skip rule) are undefined. OQ-03 is still open. Name comparison is self-asserted (ADR-0008). Is the match exact or case-insensitive? Is whitespace trimmed? What about "J. Park" vs "Jordan Park"? | BR-10, BR-20, US-16, US-30, OQ-03 | major | BusinessAnalyst |
| QA-08 | BR-41/US-31: only the 3.0 → "Defined" band is known. Other band thresholds are open (OQ-09), and so is the rounding of the mean. Results with fewer than 8 answers are unspecified (BR-28). | BR-28, BR-41, OQ-09 | major | BusinessAnalyst |
| QA-09 | US-12 trends (opened vs closed over 12 weeks, severity mix, by-standard view, Pareto) have no definitions: week boundaries and timezone, what counts as "opened", and the Pareto 80% cut. | US-12 | major | BusinessAnalyst |
| QA-10 | US-10 filter ACs don't say how filters combine (AND across facets?) and don't define the empty-result state. US-18 doesn't define the tie-break when scores are equal. | US-10, US-18, BR-16 | minor | BusinessAnalyst |
| QA-11 | BR-14 says sort "by severity, then age", but the direction of age (oldest first?) isn't stated. Records also shows "days left", so is age measured by openedAt or by due date? GSI1 is keyed `severityRank#openedAt`. | BR-14, US-11, overview §5 | minor | BusinessAnalyst |
| QA-12 | US-41 (⌘K) says "search records, modules, docs", with no matching rules or result scope. The full list wasn't captured (BRD §10). | US-41 | minor | BusinessAnalyst |
| QA-13 | BR-37/US-37 supersede: "same document" isn't defined. The key is `DOC#<docNo>#REV#<rev>` (overview §5). Open questions: re-releasing the same revision, releasing an older revision number, and two concurrent releases. | BR-37, OQ-17 | major | BusinessAnalyst / Architect |
| QA-14 | The CAPA/NCMR 6-stage workflow (BR-13) has no transition rules. Can stages be skipped or moved backwards? Who can close? Which fields are required per stage? Steps 2–6 were never observed (OQ-06). The server can't be tested beyond "Step 1". | BR-13, OQ-06 | major | BusinessAnalyst |
| QA-15 | BR-22 states the FAI report number format as `FAIR-YYYY-xxxxxxxx`, while the observed value is `FAIR-2026-1576064A`. The character set and the uniqueness guarantee aren't specified. Same issue for the `CAL-DEMO-` and `DOC-DEMO-` ID formats in the build (the "DEMO" prefix may not apply). | BR-12, BR-22, BR-39 | minor | BusinessAnalyst |
| QA-16 | BR-11 (reviewer name required) and US-14 give no max length or allowed characters. Overview A-06 gives free-text ≤ 32 KB, but no field-level limits exist anywhere. | BR-11, A-06 | minor | BusinessAnalyst |
| QA-17 | Two BR-46 inconsistencies. BR-46 says the app writes events by "conditional put" and IAM denies updates/deletes. But overview §7 says the Domain `DeleteItem` deny is prod-only, while `30-api.yaml` denies `DeleteItem`/`BatchWriteItem` on Domain in **all** envs. Separately, overview §7 lists "TransactWrite" while the template has no such action (IAM evaluates the per-item actions). Align the docs to the template. | BR-46, overview §7, 30-api | minor | Architect |
| QA-18 | BRD numbering puts BR-31/32 after BR-47, and §1.1 still lists "server-side persistence" as out of scope, which contradicts BR-45. | BRD §1.1, §7 | minor | BusinessAnalyst |

## 2. Missing negative and edge cases

| ID | Finding | Ref | Sev | Owner |
|---|---|---|---|---|
| QA-19 | Attestation value variants aren't covered: `"true"` (string), `1`, `false`, `null`, field absent, duplicated JSON keys. Requests with no free-text field at all: do they need attestation? Updates (PUT/PATCH) vs creates. Is free text in nested arrays (e.g. PO `findings[]`, FAI Form 3 cells) screened? | BR-44 | major | QA (cases) / Architect (rule) |
| QA-20 | Marker evasion and false-positive cases are missing: mixed case, `I T A R`, zero-width chars, homoglyphs, line breaks inside "Distribution\nStatement", URL-encoded text, markers in location/URL fields (ADR-0007: "validated text/URLs"), and legitimate words containing markers. Expected behaviour needs to be defined for each. | BR-44, QA-03 | major | QA / BusinessAnalyst |
| QA-21 | Is a blocked save (422) itself audited, and is the 400 counted? The `GateBlocks` alarm (50-observability) needs a custom `SentinelQA/ControlledDataBlocked` metric that nothing specifies the app emits. Logging only the marker id needs a negative test: the log must not contain the text. | BR-44, 50-observability | major | Architect |
| QA-22 | Audit write atomicity: what happens if the `TransactWriteItems` audit put fails its condition (ULID collision, retry after a timeout)? Is there idempotency on client retry, so a double-submit doesn't produce two "Created" events? | BR-46, overview §4 | major | Architect |
| QA-23 | Date edge cases for BR-24/25: +N months from Jan 31 / Feb 29, due today (day 0 = Overdue or Due soon?), exact threshold boundary days (inclusive or exclusive), timezone of "today" (OQ-16 suggests a UTC date while users are US/CT), and DST. | BR-24, BR-25, BR-18, OQ-16 | major | BusinessAnalyst |
| QA-24 | Training Undo (BR-40): is Undo audited, and what status does it restore when the due date has passed in the meantime? SQ re-evaluation date earlier than approval date; approval date in the future. | BR-35, BR-40 | minor | BusinessAnalyst |
| QA-25 | FAI SoD: preparer = evaluator with different case or whitespace; a preparer who un-signs; editing Form 1/3 after sign-off. FAI Form 3 FAIL row without NCR (BR-34 says "a row needs … NCR if Fail", but completeness is also "advisory"; which applies?). | BR-33, BR-34 | major | BusinessAnalyst |
| QA-26 | Concurrency and limits: two users editing the same record (no optimistic locking specified), payloads just under/over 32 KB (A-06) and the DynamoDB 400 KB item limit for snapshot-bearing audit events, and API throttling at 20 rps / 40 burst (params) returning 429. | A-06, O-05, params | minor | Architect |
| QA-27 | Deferral checks: `/api/ai/*` must 404 (no route in 30-api), /demo and /try-your-document hidden or static (A-10, O-06 still undecided), `AI_DRAFT_*` events never emitted, `aiAssisted:false` default. O-06 makes the expected UI outcome ambiguous. | §12 #1, O-06 | minor | BusinessAnalyst |

## 3. Verifying BR-44, BR-46, BR-47

### 3.1 BR-44 controlled-data gate
**Approach**
- **Unit** (gate middleware, pure function): table-driven tests of attestation × marker presence × field location. Property-based tests (fast-check) generate random text with and without injected markers to check that a marker always blocks and that clean text never does under the agreed matching rule (QA-03).
- **Contract/coverage**: generate the free-text endpoint inventory from the OpenAPI spec (QA-02). A test iterates **every** write route × every string field and asserts 400 without attestation and 422 with a marker. A CI check fails if a new write route isn't registered with the gate. This is the only practical evidence for "every endpoint".
- **Integration** (Lambda handler + DynamoDB Local / dev table): after a 400 or 422, assert **no** Domain item and **no** AuditLog item were written. After success, assert the AuditLog event has `controlledDataAttested=true`.
- **Log hygiene**: capture CloudWatch/stdout during the 422 tests and assert the log contains the marker id and contains neither the payload nor the matched substring (grep for a unique canary string).
- **Config**: change the SSM marker list in dev, then assert the new marker blocks after the documented cache TTL (the TTL itself must be specified; see QA-31).
- **E2E** (Playwright): the button stays disabled when unticked, the 422 message renders, and user input is preserved.
- **Bypass**: call the API directly (curl/Postman/k6) without the UI to prove server-side enforcement (the ADR-0005 rationale).

**Evidence**: test report with the endpoint×field matrix, log-scan output, audit item dumps, and CI run link.

### 3.2 BR-46 append-only audit
**Approach**
- **IAM static**: `cfn-lint` plus a custom rule or `cfn-guard`/Checkov policy asserting that the records-api role has an explicit Deny on `dynamodb:UpdateItem/DeleteItem/BatchWriteItem` for the AuditLog ARN, and only `PutItem` Allow on it.
- **IAM dynamic**: run `aws iam simulate-principal-policy` against the deployed role for each denied action. Assert `explicitDeny` in dev, stage and prod (read-only, safe in prod).
- **Live negative test (dev/stage)**: assume the records-api role (or a test role cloned from the policy) and attempt UpdateItem and DeleteItem. Expect AccessDenied, and a CloudTrail event as evidence.
- **Overwrite gap**: IAM allows `PutItem`, so append-only against overwrite depends **only** on the `attribute_not_exists` condition in code. Write a unit/integration test that issues a put with an existing PK/SK and expects `ConditionalCheckFailedException`. A code-review checklist item should require every AuditLog write to go through one repository function. (Finding QA-28.)
- **Behavioural**: correct a record and assert a new event exists while the original event is unchanged (byte-compare the snapshot). No API route may update or delete an audit event (route inventory test).
- **`prevHash`** (optional per ADR-0006): if implemented, add a verifier job that walks the chain per entity. If not, mark it N/A.
- **C-1 env difference**: verify that prod has `DeletionProtectionEnabled=true` and dev/stage don't (`aws dynamodb describe-table`). The table-reset procedure for dev/stage should be a documented admin runbook, tested in dev only.
- **Backup cross-check (prod)**: compare the exported AuditLog history with the live table to detect tampering (ADR-0006 note).

**Evidence**: simulate-policy JSON, AccessDenied plus CloudTrail entries, test logs, describe-table outputs.

### 3.3 BR-47 configurable thresholds
**Approach**
- **Unit**: status functions take thresholds as input. Run boundary-value tests at T-1, T and T+1 days for each module (calibration, training, supplier re-eval) and each band cut-off, plus weight permutations for the supplier score with a reference implementation or spreadsheet oracle. This needs QA-01 values.
- **Schema**: a JSON Schema for each SSM param, validated in CI against `params` and the template defaults. Malformed or missing param → defined fallback or error (unspecified today; QA-31).
- **Integration (dev)**: `aws ssm put-parameter` with new values, then call `reports-api` and assert the derived statuses and buckets change with **no redeploy**. That is the core evidence that the values aren't hard-coded.
- **Static**: a grep/lint rule in CI that flags numeric literals like 30/60/90 in status code paths.

**Evidence**: before/after API responses, the SSM parameter version history, and test logs.

## 4. Environments and synthetic data

| ID | Finding | Ref | Sev | Owner |
|---|---|---|---|---|
| QA-28 | Overwrite risk on AuditLog: IAM permits `PutItem`, so a put without a condition would silently replace an event. The IAM deny doesn't cover this. A mandatory test and code guard are needed (see 3.2). | BR-46, 30-api | major | Developer |
| QA-29 | Stage is "less prod-like" (ADR-0013). PITR, export, deletion protection and 5 of 6 alarms are strict-only, so these can only be verified in prod ("post-deploy export test"). Recommend a short-lived strict-profile ephemeral stack (e.g. `SentinelQA-qa-*` with synthetic data), or running stage with `EnvProfile=strict` before go-live. Note: `EnvName` AllowedValues is only dev/stage/prod. | ADR-0013, 20-data | major | InfraDeploy |
| QA-30 | The `ApiServerErrors` alarm uses `Dimensions: ApiId = TODO-ApiId` (50-observability), so it would never fire. `cfn-lint` passes because the value is a string. Testing needs alarm-fires checks (`set-alarm-state` or induced 5xx). | 50-observability | major | InfraDeploy |
| QA-31 | SSM read semantics are unspecified: caching TTL in Lambda, behaviour on missing or malformed params, and param versioning for auditability of threshold changes. | BR-47, overview §3 | major | Architect |
| QA-32 | There are no CI workflows, no test framework and no API contract in the repo. ADR-0012 defines only cfn-lint → package → change set → approval → execute, with no test stage. | ADR-0012 | major | InfraDeploy |
| QA-33 | The export bucket uses `NoncurrentVersionExpiration: 30 days` (25-backup), so an overwritten or deleted export disappears after 30 days. That weakens the "independent copy" argument for audit tamper detection (ADR-0006 note). Add it to the O-12 decision. | ADR-0006, O-12, 25-backup | minor | InfraDeploy |
| QA-34 | No synthetic dataset spec exists, yet BR-45 forbids real data in dev/stage. There's no guard that prevents loading real data (e.g. a seed-only loader or a data-classification check). | BR-45, O-08 | major | QA / InfraDeploy |
| QA-35 | The deploy role has a TODO for CloudFormation resource permissions (00-bootstrap). Deployment, and therefore any environment-based testing, isn't possible yet. | 00-bootstrap | major | InfraDeploy |

**Environments needed**
- **Local**: Node/TS unit tests; DynamoDB Local or Testcontainers for repository tests; SSM mocked (aws-sdk-client-mock).
- **dev (lean)**: integration and API tests, IAM negative tests, SSM-change tests; resettable (C-1).
- **stage (lean)**: E2E (Playwright), regression and performance smoke against throttling; manual approval gate.
- **strict-profile pre-prod (recommended, QA-29)**: PITR, export Lambda, deletion protection and alarms.
- **prod**: read-only post-deploy checks only (simulate-policy, describe-table, a smoke GET, the one-time full export from overview §14).

**Synthetic data (all labelled synthetic, no real customer data, per BR-45)**
- Baseline seed mirroring the BRD samples: 6 records (§4.5), 5 instruments (§4.11), 6 training rows (§4.12), 5 SQ records (§4.8), 4 suppliers (§4.7), PO-2026-4471 findings, NCMR-2026-0087. These are the oracles for dashboard counts (BR-42 "8") and sorting (BR-14).
- Date-relative generator: due dates at offsets −1, 0, 1, T−1, T and T+1 for each configured threshold, re-computed on each run (frozen clock in unit tests).
- Supplier scoring matrix: combinations of SCARs, on-time %, criticality and cert days around band cut-offs.
- Gate corpus: a positive marker set (all SSM markers in case, spacing and Unicode variants), a negative corpus of aerospace text with near-miss words, and a unique canary token for the log-hygiene tests.
- SoD name variants: identical, case or whitespace differences, initials vs full name.
- Volume set: about 7 years × pilot volume (A-01) for query/trend performance.

## 5. Initial test strategy outline

**Levels and types**
| Level | Content | Tooling |
|---|---|---|
| Static | IaC lint and policy-as-code (BR-46 deny, Retain, no TTL, env-prefixed ARNs, no AI route); TS lint/typecheck; secret scan | cfn-lint (already used), cfn-guard or Checkov, ESLint, tsc, gitleaks |
| Unit | Gate, status/threshold functions, score, SoD checks, QMS mean/gaps (BR-41), ID generation, date math | Vitest or Jest, fast-check |
| Component / repository | DynamoDB access patterns (GSI1/GSI2), TransactWrite with audit, conditional put | DynamoDB Local / Testcontainers |
| Contract / API | OpenAPI-driven: every route × validation, 400/422/429, error schema | Schemathesis or Dredd plus a custom gate-coverage test |
| Integration (cloud) | IAM deny, SSM reconfig, logs, alarms | AWS CLI scripts, `simulate-principal-policy` |
| E2E / UI | BRD user journeys §3 (non-AI) and US ACs; disabled-button gates; accessibility smoke | Playwright, axe-core |
| Non-functional | Throttling (O-05), latency smoke, payload limits (A-06) | k6 |
| Security | Gate bypass, IAM, OWASP baseline on public endpoints (no WAF, ADR-0011) | OWASP ZAP baseline |
| Ops / DR (prod path) | Export job, restore drill (O-10) | Scripted runbook test in the strict-profile env |

**Entry criteria**: the blockers QA-01..03 are resolved (values, endpoint inventory, matching rule); ACs updated for QA-04/06/07; OpenAPI contract available; dev env deployable (QA-35); synthetic seed available.

**Exit criteria**: 100% of in-scope BR/US traced to at least one passing test (traceability matrix BR → test id); BR-44 coverage matrix 100% of write routes × string fields; BR-46 deny verified per env with evidence; BR-47 boundary suite green with the agreed values; no open blocker or major defects; unit coverage ≥ 80% on domain/gate modules (proposed target); E2E journeys green on stage.

**CI integration** (extends ADR-0012)
1. PR: lint, typecheck, cfn-lint plus cfn-guard, unit, component (DynamoDB Local), contract tests against a local handler, gate-coverage check. All must pass to merge.
2. Main → dev: deploy change set, then integration plus IAM negative tests plus SSM reconfig tests; publish JUnit and evidence artifacts.
3. Stage: manual approval → deploy → Playwright E2E, ZAP baseline, k6 smoke.
4. Prod: manual approval → deploy → read-only post-deploy checks (simulate-policy, describe-table, smoke). Retain artifacts as audit evidence.

---

## Summary
| Severity | Count |
|---|---|
| Blocker | 3 (QA-01, QA-02, QA-03) |
| Major | 21 |
| Minor | 11 |
| **Total** | **35** |

---

## Re-check — 2026-10-13 (2:19 PM CT) against local main 248a426

Inputs: BRD v1.5 (248a426), `docs/requirements/dp-proposals.md` (APPROVED; DP-01..DP-20, O-02 and O-05 decided), Architect updates 273a7ad (`api/openapi.yaml` with `x-decision`, DP-12 timezone, DP-20 SSM param, DP-03/16). Line numbers are for files at 248a426. The repo still has no application code or tests, so this re-check covers testability of the specs only.

### Blockers and requested majors
| ID | Status | Evidence |
|---|---|---|
| QA-01 | **Resolved** (testable) | BR-47 values now exist as config with a schema. `iac/templates/20-data.yaml:77` has the DP-16 weights/bands JSON (sums to 1 ±0.001). `:84` due-soon-days 30/30/30, `:91` capa-ncmr default-due-days 30, `:98` timezone America/New_York. BRD:290, :292, :299 (bands, inclusive boundaries, TZ). The values are PLACEHOLDER, so tests must be parameterised from config rather than hard-coded. |
| QA-02 | **Resolved** | `api/openapi.yaml` lists every route (`:36`–`:1950`) and marks free-text fields `x-free-text` (18 occurrences). `30-api.yaml:188+` has explicit RouteKeys generated by `iac/tools/gen-routes.py` (overview:41). This is enough to drive the endpoint × field gate matrix. |
| QA-03 | **Resolved** | BR-44 (BRD:327) sets whole-word, case-insensitive matching, a marker list including EAR, and CFR ranges. DP-03 (BRD:577; dp-proposals:79-86) adds NFKC, case-fold and separator normalisation and defines exempt fields. Config: `20-data.yaml:105` markers and `:112` cfr-ranges. A reference check exists in `iac/tools/test_marker_patterns.py`. |
| QA-04 | **Resolved** | US-02 build ACs for 400/422, nothing persisted, no audit event, no text logged, the 422 message, and input kept (BRD:340). US-15 (BRD:368) points to BR-44, so it's covered through US-02. |
| QA-05 | **Resolved** | Middleware order is origin check → workspace → gate (400, then 422) before domain validation (overview:54). Error schema with `code` enum and `markerId` (openapi:1985-2010). Attestation is `type: boolean`, missing or false → 400 (openapi:2061-2063). |
| QA-28 | **Partially resolved** (non-blocking) | IAM still allows `PutItem` on AuditLog (`30-api.yaml:59`). The overwrite guard is the `attribute_not_exists` condition in code (overview:56), and developer-review:32 accepts the IAM limit and calls for the integration test. It stays a mandatory test (§3.2) and needs a single audit write path in code. |
| QA-29 | **Open** (non-blocking) | PITR, export and deletion protection are still strict-only. ADR-0013:37 relies on "prod change-set review and a post-deploy export test", and there is no strict-profile pre-prod env. Residual risk is accepted, but there's no runbook step for that post-deploy export test yet. |
| QA-30 | **Resolved** | `50-observability.yaml:37` now uses `Fn::ImportValue SentinelQA-<env>-ApiId`, so the `TODO-ApiId` is gone. |

### All other findings
| ID | Status | Evidence |
|---|---|---|
| QA-06 | Resolved | US-08 "8" is reclassified as a seed check (BRD:550); BR-42 plus DP-20 define the rule (BRD:594). |
| QA-07 | Resolved | DP-08 (BRD:284, :582); openapi:2448 (409 `sod_violation`). |
| QA-08 | Resolved | DP-06 (BRD:580); openapi:2654. |
| QA-09 | Resolved | DP-14 (BRD:588); openapi:1910. |
| QA-10 / QA-11 | Resolved | DP-13 (BRD:290, :587); openapi:1824. |
| QA-12 | Resolved | DP-15: ⌘K search is client-side (BRD:556). |
| QA-13 | Resolved | DP-11 (BRD:585). |
| QA-14 | Resolved | DP-02 specs and transitions (BRD:507ff, :576). |
| QA-15 | Resolved | DP-01 (BRD:286). |
| QA-16 | Resolved | DP-04 (BRD:578). The values themselves are marked GUESS in dp-proposals:94 but are approved. |
| QA-17 | Resolved | Domain Delete/BatchWrite denied in all envs, and the docs now match (`30-api.yaml:69`, ADR-0006 "Soft delete and resets"). |
| QA-18 | Resolved | BRD §1.1 (BRD:25) and the BR renumbering (v1.3 changelog, BRD:607). |
| QA-19 | Resolved | Attestation is boolean, required only on free-text endpoints (openapi:2063; DP-03 item 5). |
| QA-20 | Resolved | DP-03 normalisation; other evasion is explicitly covered only by the attestation (BRD:577). |
| QA-21 | Resolved | A 422 writes no audit event; EMF metric `ControlledDataBlocked`; `markerId` only in logs (overview:54, :63, :78). |
| QA-22 | Resolved | Idempotency-Key → `ClientRequestToken`, `version` conditions, 412/428/409 (overview:56; openapi:18). |
| QA-23 | Resolved | DP-12 (BRD:299, :586). |
| QA-24 | Resolved | Undo audited (BRD:323), DP-07, DP-19 (BRD:318). |
| QA-25 | Resolved | DP-08 and DP-09 (BRD:317). |
| QA-26 | Partially resolved | Concurrency and idempotency are decided, and O-05 sets throttling at 10/20 (overview:184). The 400 KB audit-snapshot item limit is still unaddressed. Minor. |
| QA-27 | Resolved | DP-18 (static pages); `/api/ai/*` not routed (openapi:31). |
| QA-31 | **Open** | No SSM read cache TTL or malformed-param fallback is specified (no match in the overview). Major, non-blocking. |
| QA-32 | **Open** | Still no `.github/workflows` and no test stage in ADR-0012. Major, non-blocking (expected before code). |
| QA-33 | **Open** | `25-backup.yaml:34` still has `NoncurrentDays: 30`. Minor; tracked with O-12 pre-go-live. |
| QA-34 | Partially resolved | The seed loads through the normal write path with `isSample=true` (overview:117). There is no technical guard against loading real data into dev/stage; the control is procedural (BR-45). |
| QA-35 | Resolved | `00-bootstrap.yaml` rewritten (310 lines changed), no remaining TODOs; runbooks `bootstrap-admin-run.md` and `first-deploy.md`. |

**Tally:** 27 resolved, 3 partially resolved (QA-26, 28, 34), 4 open (QA-29, 31, 32, 33). No blockers remain.

### Verdict: **SIGN-OFF** (QA)
No blockers remain. Carried forward, all non-blocking:
| Item | Sev | Owner |
|---|---|---|
| QA-28: mandatory integration test proving an AuditLog overwrite fails with `ConditionalCheckFailed`, plus a single audit write path | major | Developer / QA |
| QA-29: no prod-like pre-prod. Add the post-deploy PITR/export test as an explicit runbook step, or use a short-lived strict-profile env | major | InfraDeploy |
| QA-31: specify SSM cache TTL and behaviour on missing or malformed params | major | Architect |
| QA-32: CI workflows with a test stage (lint, unit, contract, gate coverage) before the first code merge | major | InfraDeploy |
| QA-01 follow-up: PLACEHOLDER weights, bands and due days must be tuned before go-live. Tests read values from config | minor | BusinessAnalyst |
| QA-26: 400 KB audit-snapshot item size limit | minor | Architect |
| QA-33: export bucket `NoncurrentDays: 30` (with O-12) | minor | InfraDeploy |
| QA-34: guard (or checklist) against loading real data into dev/stage | minor | InfraDeploy |
| OQ-08 (FAI Form 2) is still open, and so are /compare content and fixture publication (BRD:612). No test oracle until decided | minor | BusinessAnalyst |

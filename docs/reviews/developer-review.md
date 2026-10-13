# Developer review: BRD v1.2.3 and architecture v0.4

| Item | Value |
|---|---|
| Reviewer perspective | Developer (implementing the non-prod build: records-api, reports-api, SPA) |
| Reviewed at | HEAD `2e7213e` (BRD v1.2.3; Architect template fixes in `2c28676`) |
| Inputs | `docs/requirements/BRD.md` (v1.2.3, §6–§8, §12), `docs/architecture/architecture-overview.md` v0.4, `diagrams.md`, `adr/0001`–`0013`, `cost-estimate.md`, `docs/architecture/iac/templates/*.yaml`, `iac/params/*.json` |
| Related reviews | [ba-review.md](ba-review.md) (BA-xx), [architect-review.md](architect-review.md) (F-xx), [infra-review.md](infra-review.md) (B-x/M-x/m-x), [qa-review.md](qa-review.md). Findings already raised there are only cross-referenced unless the developer impact is new |
| Tooling | `cfn-lint` 1.57.2, `-r us-east-1`, all 7 templates: **0 errors, 0 warnings** (re-run at HEAD). `aws cloudformation validate-template` not run (no AWS session; nothing deployed) |
| Note on paths | The task referenced `iac/templates`; the templates actually live at `docs/architecture/iac/templates/`. There is **no application source tree** in the repo (no `package.json`, `tsconfig`, `src/`) |

## Summary
The scope decisions are clear enough to start: AI is cut cleanly to a seam (BRD §12 #1, overview §6), persistence is DynamoDB with an audit side-table, and the templates lint clean. The design is **not yet buildable without guesswork**, though, for three developer reasons that other reviews don't cover:

1. **There is no API contract.** The only endpoint named is `POST /api/quality-records` (overview §4 step 1), while the only route deployed is `ANY /api/records/{proxy+}` (`30-api.yaml:147`). There's no resource list, payload schemas, error envelope, pagination, idempotency or concurrency model.
2. **The IAM as written breaks core stories.** `records-api` can't read the AuditLog, so the timeline (US-03, BR-08/36) can't be displayed (`30-api.yaml:49-51`). `reports-api` can't read it either. Domain `DeleteItem` is denied in every environment (`30-api.yaml:55-57`).
3. **There's no code layout or build convention.** The templates expect prebuilt zips at `index.handler` (`30-api.yaml:86-92`), but nothing defines the repo layout, bundler, artifact naming or how a new S3 key gets into a stack update.

Many acceptance criteria are written against **demo seed data and demo strings** ("8 items", `CAPA-DEMO-xxxx`, "Simulate second reviewer"). Several in-scope workflows have **no field-level spec** (CAPA/NCMR steps 2–6, SQ steps 3/4/6, manual PO-check entry, supplier master data). These block feature work on those modules, not the platform.

**Counts:** blocker 4 · major 12 · minor 9 (25 total). Owners (corrected 2026-10-13): **BA 9** as primary owner (#4, #10, #11, #12, #13, #14, #15, #21, #22), plus #5 shared (Architect, with BA for semantics) = **10 with BA involvement**; **Architect 16** (#1, #2, #3, #5, #6, #7, #8, #9, #16, #17, #18, #19, #20, #23, #24, #25). The original "BA 11, Architect 14" was a miscount; BA's count of 10 in [ba-responses.md](ba-responses.md) is correct.

## Issues

### Blockers
1. **[blocker] No API contract (resources, payloads, errors).** Owner: **Architect.**
   Evidence: overview §4 step 1 names only `POST /api/quality-records`. `30-api.yaml:147` routes `ANY /api/records/{proxy+}`, so the path in the doc doesn't match the route. `30-api.yaml:153` routes `GET /api/reports/{proxy+}`, but no report resources are defined. There's no error envelope beyond the gate codes in `diagrams.md` (`400 gate:attestation_required`, `422 gate:controlled_marker`). Nothing covers validation errors (BR-17/22/23/26 messages), 404, 409 conflicts or SoD violations. Architect F-11 and infra m-6 note the catch-all route only as a throttling/O-05 matter. For a developer it's the missing contract.
   Fix: add `docs/architecture/api/openapi.yaml` (OpenAPI 3.1) as the source of truth. It should cover a resource per entity (`/api/quality-records`, `/api/suppliers`, `/api/supplier-qualifications`, `/api/po-checks`, `/api/fai`, `/api/fai/{id}/characteristics`, `/api/calibration`, `/api/training`, `/api/documents`, `/api/approval-roles`, `/api/qms-assessments`, `/api/{entity}/{id}/events`, `/api/reports/dashboard|trends`); request/response schemas with the reserved `draft`/`aiAssisted` fields; and one error shape, e.g. `{error:{code, message, fields[{name,message}]}}`, with codes 400/404/409/412/422 (gate vs domain-rule 422 told apart by `code`). Generate TS types from it and make routes explicit in `30-api.yaml` from the same list.

2. **[blocker] records-api can't read the audit log, so the timeline can't be shown.** Owner: **Architect.**
   Evidence: `30-api.yaml:49-51` grants only `dynamodb:PutItem` on the AuditLog table. There's no `Query`/`GetItem`, and `reports-api` (`30-api.yaml:~70-80`) has nothing on AuditLog. US-03 ("the timeline shows 'Created · <reviewer> · stage: new'"), BR-08 and BR-36 (SQ audit trail), and the FAI/CAPA print views all need `Query` on `WS#ws#ENT#<id>`. The `prevHash` tamper signal (ADR-0006) also needs to read the latest event before writing.
   Fix: add `dynamodb:Query` (and `GetItem`) on the AuditLog ARN to records-api, or to reports-api if timelines are served there. Keep the explicit Update/Delete/BatchWrite deny. Related: BA-02 (PutItem can overwrite). IAM can't enforce conditional puts, so the complementary fix is to keep `attribute_not_exists(PK)` in code and add an IAM-negative integration test (QA §3.2).

3. **[blocker] No code layout, build or artifact convention for TypeScript Lambdas.** Owner: **Architect.**
   Evidence: `30-api.yaml:86-92,104-108` use `Handler: index.handler`, `Code: {S3Bucket: ArtifactBucket, S3Key: RecordsApiKey}`. Params are `"TODO"` (`params/dev.json`). ADR-0010 says "packaged as S3 artifacts" and ADR-0012 says "package Lambda", with no detail. The overview mentions `src/ai/` but the repo has no source tree. Infra B-2/B-4 cover the missing bucket and zips. What's still missing for a developer is the convention. CloudFormation only updates function code when `S3Key` (or `S3ObjectVersion`) changes, so a fixed key means silent no-op deploys.
   Fix: write an ADR or README section that sets out: (a) a monorepo layout, e.g. `app/functions/records-api/src/index.ts`, `app/functions/reports-api`, `app/functions/ddb-export`, `app/packages/domain` (shared rules: gate, SoD, derived status), `app/packages/ai` (seam), `app/web` (SPA); (b) bundling with esbuild (`--platform=node --target=node24 --format=esm --bundle --minify --sourcemap`, output `index.mjs`, so `Handler: index.handler` still resolves). Use AWS SDK v3 bundled or marked external, and decide which; (c) artifact key `<fn>/<git-sha>.zip`, passed as `RecordsApiKey`/`ReportsApiKey` on every deploy; (d) handlers `async` only. The Node.js 24 Lambda runtime no longer supports callback-style handlers. Verify against current AWS docs before coding.

4. **[blocker] CAPA/NCMR steps 2–6, SQ steps 3/4/6 and manual PO-check entry have no field spec.** Owner: **BA.**
   Evidence: BRD §4.6 documents step 1 only. OQ-06 says steps 2–6 were "not captured (AI-gated)". OQ-07 says SQ steps 3/4 and 6 were not captured. §4.9 and BR-21 say PO findings "are entered manually in the build", but there's no observed form, because the only observed UI is the AI paste box. Overview §2 nonetheless lists these as in scope ("6-stage workflow", "6-step wizard", "Stored PO check records (manual entry)"). BA-08 covers transition rules, not fields.
   Fix: for each step, list fields, types, required flags, free-text fields (which drive the BR-44 gate scope, BA-05) and exit criteria. For PO checks, define the manual-entry form: PO header fields plus a findings grid with requirement, status, clause, suggested wording and why-citation. Until then, mark those stories "blocked on spec" and build step 1 plus generic stage advance only.

### Major
5. **[major] Domain `DeleteItem` is denied everywhere, which breaks "Remove role", Training "Undo" semantics and Form 3 row removal.** Owner: **Architect** (with BA for semantics).
   Evidence: `30-api.yaml:55-57` denies `DeleteItem`/`BatchWriteItem` on Domain in all profiles. Overview §7 says "in prod". BRD §4.14 has "Remove role" and US-36 lets users edit Form 3 rows. BA-09 raised the inconsistency. The developer impact: every "delete" must become a soft-delete (`deletedAt` + filter on every query/GSI), and that has to be decided before the first entity is coded.
   Fix: decide "soft delete for all Domain entities" (recommended: it fits the 7-year retention) and document it in overview §5. Then keep the deny, and drop "in prod" from §7.

6. **[major] GSI design is under-specified and one attribute name is shared across entities.** Owner: **Architect.**
   Evidence: `20-data.yaml:30-43`: GSI2's range key is the literal attribute `dueDate`, but overview §5 names the per-entity dates `needByDate` (QR), `reevalDate` (SQ) and `nextDue` (CAL), each "(GSI2)". `GSI1PK`/`GSI2PK` values aren't defined anywhere. GSI1 "stage/severityRank#openedAt" can't serve BR-14 if "Awaiting your review" spans more than one stage (the Records sample includes SCAR-2026-0044 in *Draft Ready* and NCMR-2026-0087 in *QM Review*, BRD §4.5). List screens (Records filters US-10, Training matrix, Calibration tabs) have no defined access pattern beyond `Query PK=WS#ws, begins_with(SK,'CAL#')`.
   Fix: add an access-pattern table to overview §5 (pattern → table/index → key condition → filter). Define, e.g., `GSI2PK = WS#ws#DUE#<entityType>`, `dueDate` = the single sort attribute each writer copies its date into (and say so). Make `GSI1PK = WS#ws#REVIEWQ` sparse, written only while a record is in the review set, so BR-14 is a single query.

7. **[major] Pagination, sorting and limits are not specified.** Owner: **Architect.**
   Evidence: no mention in overview §4/§5 or the ADRs. DynamoDB `Query` returns at most 1 MB per page, and `Projection: ALL` on both GSIs (`20-data.yaml:40,43`) inflates pages. ADR-0003 says trends are "computed by query at pilot scale", i.e. a full scan of the workspace partition per dashboard load. Lambda timeout is 10 s (`30-api.yaml:89,107`).
   Fix: standard `?limit=&cursor=` (an opaque base64 of `LastEvaluatedKey`) on every list. Default 50, max 200. Document that `reports-api` reads the whole partition by paging internally, and set a measured budget (e.g. < 2 s at 5k items). Otherwise keep pre-aggregated counters.

8. **[major] Idempotency and concurrency aren't defined for writes.** Owner: **Architect.**
   Evidence: overview §4 step 4 uses `TransactWriteItems`, but there's no retry/idempotency rule. CloudFront plus browser retries can double-create records (new ULID per attempt), and two editors can overwrite each other's stage moves. Audit SK `<ts>#<ulid>` keeps events unique but doesn't stop duplicate events.
   Fix: (a) the client sends an `Idempotency-Key` header on POST, passed as `ClientRequestToken` to `TransactWriteItems` (10-minute dedupe window), plus a deterministic ID where possible; (b) optimistic locking with a `version` attribute: `ConditionExpression version = :expected`, `If-Match` header, 412 on mismatch; (c) stage transitions conditional on `stage = :from`.

9. **[major] The public, unauthenticated write API is reachable directly, bypassing CloudFront.** Owner: **Architect.**
   Evidence: `30-api.yaml:~123-128` keeps the default `execute-api` endpoint, and `40-web.yaml:40-42` uses it as the origin, so anyone can call `https://<id>.execute-api…/api/records/...` without CloudFront. Auth is out of scope (ADR-0008), WAF is deferred (ADR-0011), and throttling is 20 rps/40 burst (`params/*.json`). Dev/stage are internet-writable by anyone who finds the URL. Synthetic data only, but the gate and audit log can be spammed, and the 422 path is an oracle for the marker list.
   Fix (non-prod now, prod before go-live): add a CloudFront origin custom header with a secret, checked in the Lambda middleware (403 otherwise), or a Lambda authorizer on that header. Optionally a CloudFront Function basic-auth or IP allow-list for dev/stage. Keep the ADR-0008 JWT seam.

10. **[major] The record ID and number format is undefined, and the ACs assert demo IDs.** Owner: **BA.**
    Evidence: BR-12 (`CAPA-DEMO-xxxx`), BR-22 (`FAIR-YYYY-xxxxxxxx`), BR-39 (`CAL-DEMO-xxxxxxxx`), US-13/US-17/US-26 assert those formats. Samples use sequential `NCMR-2026-0087` and `SQ-2025-014`. Sequential numbers need an atomic counter item (`UpdateItem ADD`, allowed by `30-api.yaml:45`) inside the create transaction. Random suffixes don't. BA-15 asks the question; the developer need is a decision before the first create endpoint.
    Fix: specify per entity: prefix, year scope, sequential vs random, and whether user-entered IDs (Equipment ID, Document number) must be unique, which needs a uniqueness guard item in the transaction. Rewrite the ACs to match a pattern (e.g. `^NCMR-\d{4}-\d{4}$`) rather than `DEMO`.

11. **[major] Acceptance criteria depend on demo seed data and demo-only UI.** Owner: **BA.**
    Evidence: US-08 "headline count equals … (8)". US-04 "9 criteria × 7 products" (the comparison data isn't in the BRD). US-28 "observed for M. Alvarez and L. Brandt". US-31 "all 3s → 3.0 / 5 Defined" (only one band known, OQ-09). BR-33/US-35 "Simulate second reviewer". QA §1 and Architect F-03 (seeding) touch this.
    Fix: restate each AC as a rule plus a named fixture (e.g. "Given fixture `dashboard-8`…"), and publish the fixtures as data files owned by BA. Supply the /compare table content and the full QMS band thresholds, or descope them. Decide whether "Simulate second reviewer" exists in the build (BA §5 item 2).

12. **[major] Supplier master data has no create/edit story.** Owner: **BA.**
    Evidence: US-18/US-19 rank suppliers by a score built from `onTimePct`, `openScarCount`, `criticality`, `certRenewalDate` (overview §5 SUP row), but no story or form creates or updates a supplier. SQ records hold only name/scope (BRD §4.8), and nothing links SQ ↔ Supplier ↔ SCAR. BA-12 asks whether the inputs are derived.
    Fix: add US "maintain supplier" (fields, who edits, derived vs entered: `openScarCount` should be derived from SCARs with `supplierId`), and define `supplierId` as a foreign key on QR/SQ/PO/FAI instead of free-text supplier names.

13. **[major] The controlled-data gate isn't specified to an implementable level.** Owner: **BA** (rules) / **Architect** (contract).
    Evidence: BR-44, ADR-0005, `20-data.yaml:78-83` (SSM `StringList`, so a comma inside a marker is impossible and a marker containing a comma can't be stored). BA-04/BA-05 cover matching semantics and endpoint scope. Additional developer gaps: is the gate applied to the *whole* payload or a declared field list? Is `controlledDataAttestation` required on non-free-text writes (stage advance with no notes, Mark complete)? Is the 422 body allowed to return the marker *id* to the UI (US-15 needs a message)? Does the gate re-run on read-modify-write of unchanged text? How is SSM cached (per cold start vs TTL), given BR-47 says values change without deploy?
    Fix: list gated fields per endpoint in the OpenAPI schema (`x-controlled-text: true`) and make the middleware schema-driven. Store markers as a JSON `String` param with `{id, pattern, flags}`. Return `{code:'gate:controlled_marker', markerId}`. Cache SSM for 60 s (`ssm:GetParametersByPath` is already allowed for records-api, `30-api.yaml:59`, but not reports-api).

14. **[major] Undo, corrections and "edit" conflict with append-only and snapshots, and nothing defines them.** Owner: **BA.**
    Evidence: BR-40/US-28 "Undo" after Mark complete. BR-46 says corrections are new events. Document edit reopens at `documents/new?id=…` (BRD §4.13), with key `DOC#<docNo>#REV#<rev>` (overview §5), so editing `docNo` or `rev` changes the primary key. BR-37 says supersede happens on release. BA-11 covers Undo's status rule only.
    Fix: define the event types (`TRAINING_COMPLETED`, `TRAINING_COMPLETION_REVERSED`, `FIELD_CORRECTED`…) and which fields are immutable after create (docNo/rev, part number). For documents, use an immutable surrogate `DOC#<ulid>` plus a `docNo` uniqueness item, and a new item per revision.

15. **[major] The SoD rule can't be enforced or tested without identity, and its semantics are undefined.** Owner: **BA.**
    Evidence: BR-10/20/33/35/37, ADR-0008 ("advisory until auth exists"), US-30 "Given a default would make the author also the approver" with no author identity beyond self-asserted `actorName`. BA-07 covers the definition. The developer gap: is a SoD failure a hard 422 or a warning, and is the name comparison case- and whitespace-insensitive?
    Fix: specify "hard block, HTTP 422 `sod:same_person`, names compared after trim + case-fold", and label it "advisory" in the UI per ADR-0008.

16. **[major] Template parameterization isn't developer-deployable to a personal or ephemeral env.** Owner: **Architect.**
    Evidence: `EnvName` `AllowedValues: [dev, stage, prod]` in every template. Names are fixed (`20-data.yaml:20,50`, `30-api.yaml` role/function names), and the lean tables are `Retain` (infra M-7). Developers can't stand up `dev-<name>` or PR stacks, and a failed first create of 20-data leaves orphaned tables that block the retry.
    Fix: allow `EnvName` matching `^(dev|stage|prod|dev-[a-z0-9]{1,12})$` (AllowedPattern). Use `AWS::LanguageExtensions` so `DeletionPolicy: !If [IsStrict, Retain, Delete]` works. Add a local loop: DynamoDB Local plus `sam local`-free handler tests (QA §5), so only integration needs AWS.

### Minor
17. **[minor] `reports-api` config is incomplete.** Owner: **Architect.** `30-api.yaml:100-112`: no `MemorySize` (128 MB default; aggregation will be slow), no `ENV_NAME`, no `AUDIT_TABLE`, no tracing, and SSM lacks `GetParametersByPath` (line ~80). Infra m-6 notes memory/tracing. Fix: match records-api (512 MB, env vars), and add the SSM action if thresholds are read by path.
18. **[minor] Log groups race the functions, and the basic execution role has wildcards.** Owner: **Architect.** `RecordsLogs`/`ReportsLogs` (`30-api.yaml:~113-122`) have no `DependsOn` from the functions, so a first invoke during create can auto-create the group, and the stack then fails with "already exists". `AWSLambdaBasicExecutionRole` grants `logs:CreateLogGroup` on `*` and `logs:CreateLogStream/PutLogEvents` on `*` (it's also attached in `25-backup.yaml`). Fix: `DependsOn` on the log groups, replace the managed policy with an inline `logs:CreateLogStream`/`PutLogEvents` on the specific log group ARN, or use `LoggingConfig.LogGroup`.
19. **[minor] Deploy role can modify itself.** Owner: **Architect.** `00-bootstrap.yaml:35` allows change sets on `stack/SentinelQA-${EnvName}-*/*`, which includes `SentinelQA-<env>-Bootstrap`, the stack that defines the deploy role. Line 38's `iam:PassRole` on `role/SentinelQA-${EnvName}-*` includes the deploy role itself. Together with B-1's eventual resource permissions, a workflow could widen its own permissions. Fix: exclude the Bootstrap stack (separate name prefix, e.g. `SentinelQA-bootstrap-<env>`) and limit PassRole to the CFN execution role, with `iam:PassedToService`.
20. **[minor] FAI Form 3 child-key ordering and transaction size.** Owner: **Architect.** `FAI#<uuid>#CH#<n>` (overview §5) sorts lexicographically (`CH#10` < `CH#2`), and `TransactWriteItems` caps at 100 items/4 MB, which limits a bulk grid save plus audit events. Fix: zero-pad (`CH#0001`) or use a ULID with a `charNo` attribute, and save rows individually (one tx = row + audit event).
21. **[minor] Date/time and timezone semantics are undefined.** Owner: **BA.** "Days left", "due in 12 days", Completed date (OQ-16 shows the UTC date taken on the CT evening), +6/+12/+24 months from 31 Jan, and 12-week trend buckets. Fix: store ISO dates (`YYYY-MM-DD`) for business dates and UTC instants for events, compute "days" in the workspace timezone (new setting, default America/Chicago), and use end-of-month clamping for +N months.
22. **[minor] Training recurrence and the "Not started" rule are missing.** Owner: **BA.** BRD §4.12 shows "expired 14 days ago" and "7d to start", which imply a recurrence interval and a start-by date that aren't in §6. Extends BA-11. Fix: add `recurrenceMonths`, `startBy` and the status rule table.
23. **[minor] Search (US-41) and Records/Industry filter.** Owner: **Architect.** F-10/BA-10 propose client-side search. That only works if a list endpoint returns everything, which conflicts with #7. Fix: decide on a `GET /api/search?q=` that pages over titles/IDs in the partition (pilot scale), or cap client-side search to loaded pages. Drop the Industry filter (single value, OQ-22) or make it static.
24. **[minor] Gate-block metric and structured logging conventions.** Owner: **Architect.** Infra M-3 notes the `SentinelQA/ControlledDataBlocked{Env}` metric isn't emitted. For developers, specify the logging contract: EMF via Powertools for TypeScript (`@aws-lambda-powertools/metrics`, `logger`), the exact namespace/dimension names (`50-observability.yaml:75-89`), and a rule that request bodies are never logged (BR-44).
25. **[minor] Doc inconsistencies developers will trip on.** Owner: **Architect.** Overview §7 still lists `kms:Decrypt/GenerateDataKey` on "its env key", contradicting O-09 in the same section and `30-api.yaml:27`. The diagram shows `RA & RP --> CW` (no PutMetricData is needed with EMF). Overview §3 lists `TransactWrite` as an IAM action, but there's no such IAM action (authorization is per Put/Update/ConditionCheck, which is correct in the template). Fix: clean up §7 and §3.

### What works for a developer
- `nodejs24.x` + `arm64` is accepted by cfn-lint 1.57.2 and matches D-09. TypeScript compiled to ESM works with `Handler: index.handler`.
- Env scoping by name in every IAM ARN (`SentinelQA-${EnvName}-*`, `/sentinelqa/${EnvName}/*`) is consistent and wildcard-free on data resources. The only wildcards are `index/*` (fine), the bootstrap stack/role patterns (#19) and the AWS managed basic-execution policy (#18).
- Explicit audit deny statements (`30-api.yaml:52-57`) are present in all profiles, matching BR-46 and BRD v1.2.3 BR-08.
- Cross-stack exports are consistent after `2c28676` (ApiId export now feeds the 5xx alarm).

## Effort estimate and build sequence (non-prod: dev, then stage)
Assumptions: 1 full-stack TypeScript developer, with infra B-1/B-2/B-3 resolved by InfraDeploy in parallel; blockers #1–#4 answered within the first week; AI and auth stay deferred; estimates in ideal developer-days (±30%).

| # | Phase | Contents | Depends on | Est. (days) |
|---|---|---|---|---|
| 0 | Contract and skeleton | OpenAPI (#1), access-pattern table (#6), ID/soft-delete/idempotency decisions (#5, #8, #10); monorepo, esbuild, Vitest, DynamoDB Local, CI lint/typecheck/cfn-lint, artifact upload `<fn>/<sha>.zip` (#3) | Architect/BA answers | 4–5 |
| 1 | Platform deploy to dev | Stub handlers; deploy 10 → 20 → 30 → 40 → 50 (25 is prod only); IAM fixes #2, #18; origin-secret check (#9); SPA shell with routing and deep-link fallback (infra m-5) | Phase 0, infra B-1/B-2 | 2–3 |
| 2 | Cross-cutting middleware | Workspace resolution, controlled-data gate (schema-driven, SSM cache, 422/400, EMF metric), error envelope, validation, `TransactWrite` record + audit, optimistic locking, idempotency, pagination, timeline read endpoint | Phase 1, #13 rules | 5–6 |
| 3 | Simple CRUD modules | Approval Roles (BR-19/20), Calibration (BR-23/24/25/39 derived status), Document Control (BR-26/37 supersede), Training (BR-27/40, Undo) | Phase 2 | 6–8 |
| 4 | Workflow modules | CAPA/NCMR 6-stage (BR-10–15, SoD, disposition); FAI Form 1, sign-off and Form 3 grid (BR-22/33/34); Supplier Qualification wizard (BR-17/35/36) | Phase 2, blocker #4 spec | 10–13 |
| 5 | Derived and reporting | Supplier master + deterministic score (BR-16/47, #12); PO check manual entry (BR-21); QMS Champion (BR-41); dashboard needs-attention (BR-42), threatens-delivery (BR-15), review queue (BR-14), trends/Pareto; ⌘K search | Phases 3–4 | 6–8 |
| 6 | Hardening and stage | Seed fixtures (#11, F-03), IAM negative tests and gate tests (QA §3), Playwright E2E for the US list, hidden AI pages (A-10), promote to stage via change set + approval | All | 4–5 |
| | **Total** | | | **≈ 37–48 dev-days (~8–10 weeks for one developer; ~5–6 weeks for two working phases 3/4 in parallel)** |

Critical path: blocker #1 (contract) → Phase 2 middleware → Phase 4 workflows (blocked on #4). Phases 0–3 can proceed before #4 is answered. Prod (`25-backup`, strict profile, pre-go-live checklist §14) is excluded and adds ≈ 3–4 days for export Lambda, export-status alarming (infra M-4) and a restore drill.

## Status update (2026-10-13, after BRD v1.3 and decisions)
Basis: HEAD `1a574e5`. Commits checked: `5df831e` (BRD v1.3, [ba-responses.md](ba-responses.md), DP-01..19), `3c6dbdf` (00-bootstrap: CFN exec role, artifact bucket, deploy-role lockdown, reset runbook), `84f4b74` (infra-review status), `a2874e6` (BRD v1.4: Vishwas decisions, §13.5), `1a574e5` (params filled, B-3 partial; repo/OIDC AllowedPattern; first-deploy runbook). `docs/architecture/api/openapi.yaml` exists in the working tree but is **untracked** (not committed), so it doesn't count.

Rule used here: **Resolved** only when the fix is in a commit. Architect commitments and Vishwas decisions that aren't in a commit yet are marked *committed to by X, pending* or *decided by Vishwas, pending commit*. At HEAD, `openapi.yaml` is not committed and `30-api.yaml` is unchanged since `2c28676`. The Vishwas decisions are committed in BRD v1.4 (`a2874e6` §13.5), but `20-data.yaml` hasn't been updated: line 83 still has the old marker list (no EAR or CFR ranges) and lines 71/77 still say `TODO`, not `PLACEHOLDER`.

| # | Sev | Owner | Status | Note |
|---|---|---|---|---|
| 1 | blocker | Architect | **Open**: committed to by Architect, pending | Architect committed to OpenAPI at `docs/architecture/api/openapi.yaml` with explicit routes, error, pagination, idempotency and concurrency rules. The file exists only untracked in the working tree; `30-api.yaml:147,153` are still `{proxy+}` |
| 2 | blocker | Architect | **Open**: committed to by Architect, pending | Read-only `Query`/`GetItem` on AuditLog for records-api committed to. `30-api.yaml:49-51` still PutItem only |
| 3 | blocker | Architect | **Partly**: committed to by Architect, pending | Artifact bucket now exists (`3c6dbdf`, infra B-2). Convention committed to (esbuild, `src/functions/<name>`, key `<sha>/<function>.zip`) but not documented in a commit. Note: the key order differs from my suggested `<fn>/<sha>.zip`; either works if `RecordsApiKey`/`ReportsApiKey` change every deploy |
| 4 | blocker | BA | **Partly** | BRD v1.3 §13.2 specifies PO-check manual-entry fields (observed structure only; types/lengths DP-04). CAPA/NCMR steps 2–6 and SQ steps 3/4/6 still blocked on DP-02 (Vishwas) |
| 5 | major | Architect (+BA) | **Partly** | BA side resolved in `5df831e` (§13.1 soft delete for Remove role/person, Training Undo, Form 3 rows). Architect committed to keeping the delete deny in all envs with soft delete everywhere, but overview §7 still says "in prod" and §5 has no `deletedAt` rule: pending |
| 6 | major | Architect | **Open**: committed to by Architect, pending | Committed to: per-entity date copied to a shared `dueAt` sparse GSI. `20-data.yaml:33,42` still uses `dueDate`; no access-pattern table |
| 7 | major | Architect | **Open**: committed to by Architect, pending | Pagination rules are part of the OpenAPI commitment (#1) |
| 8 | major | Architect | **Open**: committed to by Architect, pending | Idempotency and concurrency rules are part of the OpenAPI commitment (#1) |
| 9 | major | Architect | **Open**: committed to by Architect, pending | Secret origin header, checked in middleware with the value in SSM, committed to. Not in `40-web.yaml`/`30-api.yaml`. Note: if it's a `SecureString`, records-api needs `kms:Decrypt` via `aws/ssm` (or use a `String` param), and reports-api needs the same check |
| 10 | major | BA | **Partly** | `5df831e`: BR-12 build criterion and US-13/17/26 no longer assert `DEMO`. Format itself is DP-01 (Vishwas) |
| 11 | major | BA | **Partly** | `5df831e` §13.4: build criteria separated from *seed checks* (US-04/08/28/31). BR-31 sample data is allowed in all envs incl. prod (`a2874e6`, BR-31/BR-45, §13.5 #1; also answers Architect F-03's question). /compare content, Simulate second reviewer and fixtures still DP-05; QMS bands DP-06 |
| 12 | major | BA | **Open** | DP-10 (supplier master create/edit, derived inputs) awaiting Vishwas |
| 13 | major | BA / Architect | **Partly** | `5df831e` added 400/422 ACs to US-02. Whole-word, case-insensitive matching with EAR, 22 CFR 120–130 and 15 CFR 730–774 is in BR-44 (`a2874e6`, DP-03 partial), but the SSM marker list at `20-data.yaml:83` is not updated (Architect, pending). Note for implementation: CFR ranges must be patterns (e.g. `\b22\s*CFR\s*(12\d|130)\b`), not literals, and a `StringList` can't hold them cleanly, so a JSON `String` param is still needed. Field scope and attestation on non-text writes still DP-03; SSM caching still Architect |
| 14 | major | BA | **Partly** | `5df831e` §13.1 and BR-40: corrections as new events, Undo semantics. Document key edits and supersede edge cases still DP-11 |
| 15 | major | BA | **Open** | DP-08 (SoD semantics, hard vs warning, name comparison) awaiting Vishwas |
| 16 | major | Architect | **Partly** | Non-prod reset runbook and draft script in `3c6dbdf` (`docs/runbooks/nonprod-table-reset.md`, `scripts/reset-nonprod-tables.sh`; infra M-7 marked resolved by runbook). Personal/ephemeral envs (`EnvName` AllowedPattern) and a conditional `DeletionPolicy` are not addressed |
| 17 | minor | Architect | **Open** | reports-api memory, env vars and SSM path unchanged (`30-api.yaml:100-112`) |
| 18 | minor | Architect | **Open** | Log-group `DependsOn` and inline logs policy not done. 00-bootstrap now has a permissions boundary (`3c6dbdf`), which caps app roles but doesn't remove the managed-policy wildcards |
| 19 | minor | Architect | **Resolved** (`3c6dbdf`) | `DenyBootstrapStack` / `DenyBootstrapIdentities` statements, and `iam:PassRole` limited by `iam:PassedToService` (lambda, scheduler). Infra review marks it fixed (`84f4b74`) |
| 20 | minor | Architect | **Open** | FAI Form 3 key padding and transaction sizing not addressed |
| 21 | minor | BA | **Open** | DP-12 (timezone, boundaries, end-of-month) awaiting Vishwas |
| 22 | minor | BA | **Open** | DP-07 (training recurrence, Not started) awaiting Vishwas |
| 23 | minor | Architect | **Resolved** (`a2874e6`) | US-41 ⌘K is client-side over loaded lists (BRD v1.4, DP-15 resolved). The Industry-filter part stays minor/open (OQ-22). Implication for #7: the SPA must page through the lists it searches, or search only what's loaded; record which in the OpenAPI notes |
| 24 | minor | Architect | **Open** | Logging/EMF conventions not documented. Emission is a developer action (below; infra M-3) |
| 25 | minor | Architect | **Open** | Overview §3/§7 KMS/`TransactWrite` wording unchanged |

Other decisions (committed in `a2874e6`): **BR-47** ships `PLACEHOLDER` weights/thresholds, which unblocks coding against SSM. The JSON schema and band cut-offs are still DP-16, and `20-data.yaml:71,77` still say `TODO` (Architect, pending).

**Status totals:** Resolved 2 (#19, #23) · Partly 8 (#3, #4, #5, #10, #11, #13, #14, #16) · Open 15 (#1, #2, #6, #7, #8, #9, #12, #15, #17, #18, #20, #21, #22, #24, #25).
**Blockers still open:** #1 OpenAPI contract (Architect, pending), #2 audit read IAM (Architect, pending), #3 build convention (Architect, partly: bucket done, convention pending), #4 step specs (BA, partly: PO fields done, CAPA/NCMR 2–6 and SQ 3/4/6 wait on DP-02). None of the four is fully resolved.

## Developer actions
No application code will be written until Vishwas gives the go-ahead. Once he does, the developer will:
1. Scaffold `src/functions/{records-api,reports-api,ddb-export}` plus shared packages, with esbuild ESM bundles and zips uploaded as `<sha>/<function>.zip` to the bootstrap artifact bucket (after Architect commits #3).
2. Generate TypeScript types and request validation from `openapi.yaml` (after #1), and make the error envelope, pagination cursors, `Idempotency-Key` → `ClientRequestToken`, and `version`/`If-Match` locking shared middleware.
3. Middleware chain: origin-secret check (SSM, cached), workspace resolution, controlled-data gate (whole-word, case-insensitive, CFR range patterns per BR-44 v1.4; 400/422; marker id only), domain validation and SoD, then `TransactWriteItems` record + conditional audit put.
4. **Emit the `GateBlocks` metric:** EMF `SentinelQA/ControlledDataBlocked` with dimension `Env=<env>` on every 422 gate block, matching `50-observability.yaml:75-89` exactly (infra M-3). Plus structured logs that never include request bodies.
5. Soft delete (`deletedAt`) on every Domain entity and filtered out on every query; no `DeleteItem` calls.
6. Write entity dates into the shared sparse `dueAt` GSI attribute on every create/update (after #6 lands in `20-data.yaml`).
7. Timeline endpoint reading AuditLog via `Query` (after #2's IAM change).
8. Load the BR-31 illustrative seed fixtures (allowed in all envs incl. prod), labelled "ILLUSTRATIVE — SAMPLE RECORDS".
9. Read BR-47 thresholds from SSM with `PLACEHOLDER` values; nothing hard-coded.
10. IAM-negative integration tests (audit update/delete denied, Domain delete denied) and gate tests per QA §3.

## Re-verification (2026-10-13, after Architect commits `aad1cd1`..`ff3b1ef` and InfraDeploy `6260965`)
Basis: committed HEAD `ff3b1ef`, verified from a `git archive HEAD` export, so uncommitted working-tree edits to `params/*.json` and `00-bootstrap.yaml` were **not** counted. Each claim was checked against the files, not the commit messages.

**Checks run**
- `cfn-lint` 1.57.2 `-r us-east-1` on all **8** templates (new `00-account-oidc.yaml` included): **0 errors, 0 warnings**.
- `iac/tools/gen-routes.py` re-run against `api/openapi.yaml` in the export, then diffed with committed `30-api.yaml`: **no drift**, 67 routes (60 → `RecordsIntegration`, 7 → `ReportsIntegration`, over 35 paths).
- `openapi-spec-validator` (installed via pip): `api/openapi.yaml: OK`, OpenAPI **3.1.0**.
- Spec scan: every POST declares `Idempotency-Key`. Every PATCH/DELETE declares `If-Match`. Shared responses exist for 400/403/404/409/412/422/428/429. Errors are `application/problem+json`. Pagination is `?limit` (1–100, default 25) + opaque `?cursor` → `{items,nextCursor}`. DELETE is soft delete with a `DELETED` audit event. There are 13 `x-tbd` markers (DP-01/02/03/06/07/10/12, OQ-08).

**Claims verified**
| Claim | Verified at | Result |
|---|---|---|
| OpenAPI with problem+json, cursor pagination, Idempotency-Key, If-Match 412/428/409, soft delete + DELETED event, x-tbd | `api/openapi.yaml:5-20` and per-op responses | ✅ |
| 67 explicit routes generated by gen-routes.py | `30-api.yaml:164+` (BEGIN/END GENERATED) | ✅ no drift |
| records-api Get/Query on audit + indexes; deny kept | `30-api.yaml:58-65` | ✅ (AuditLog has no GSIs, so `index/*` is inert) |
| ADR-0014 esbuild, `src/functions/<name>`, `<sha>/<function>.zip` enforced | `adr/0014`; `30-api.yaml:12-19`, `25-backup.yaml:10-13` `AllowedPattern`; bucket via `ArtifactBucketName` import | ✅ |
| Sparse `dueAt` GSI2 + review-queue GSI1 | `20-data.yaml:30-43`; mapping overview §5.1 (lines 79-88) | ✅ |
| ADR-0015 X-Origin-Verify | `40-web.yaml:7-12,50-51` (NoEcho param); `30-api.yaml:114,132` env var; SSM GetParameter on `/sentinelqa/<env>/*` (`30-api.yaml:69-71,93-95`) | ✅ with a gap, see #26 |
| GateBlocks `SentinelQA`/`ControlledDataBlocked`/`Env` | `50-observability.yaml:122-136` | ✅ EMF is via log ingestion, so no `cloudwatch:PutMetricData` is needed in the role (the boundary allows it anyway). Alarm is strict-only |
| 20-data markers + PLACEHOLDER | `20-data.yaml:71-72,78-79,86` | ✅ values present; semantics gap, see #27 |

**Status per finding (supersedes the previous table)**
| # | Sev | Owner | Status | Note |
|---|---|---|---|---|
| 1 | blocker | Architect | **Resolved** (`aad1cd1`) | Spec valid, routes explicit and generated. DP-tagged fields remain `x-tbd` |
| 2 | blocker | Architect | **Resolved** (`813987a`) | `30-api.yaml:58-62`. Timeline route `GET /api/audit/{entityType}/{entityId}/events` is served by records-api, which has the read permission |
| 3 | blocker | Architect | **Resolved** (`96232f0`, `813987a`, `48beba3`) | ADR-0014 plus `AllowedPattern` on all three keys. `ArtifactBucket` removed from `params/*.json` in `48beba3` |
| 4 | blocker | BA | **Partly** | Unchanged. PO-check fields done (BRD v1.3 §13.2). CAPA/NCMR 2–6 and SQ 3/4/6 wait on DP-02 (Vishwas); the spec marks them `x-tbd: DP-02` |
| 5 | major | Architect (+BA) | **Resolved** (`813987a`, `48000e6`) | All-env deny with comment (`30-api.yaml:66-68`). Spec DELETE = soft delete; overview v0.5 updated |
| 6 | major | Architect | **Resolved** (`1c15d5c`, `48000e6`) | Sparse GSI1/GSI2 and access-pattern table §5.1 |
| 7 | major | Architect | **Resolved** (`aad1cd1`) | Cursor pagination, limit 1–100 |
| 8 | major | Architect | **Resolved** (`aad1cd1`, `48000e6`) | Idempotency-Key → `ClientRequestToken`, version/If-Match, `fromStage` 409 (overview §4 step 4) |
| 9 | major | Architect | **Partly** (`ceee66d`, `48beba3`) | Header injected and checked first. Open: KMS decrypt path (#26). The secret is created out of band and passed as a NoEcho param, and rotation is documented. Not authentication (ADR-0015 says so) |
| 10 | major | BA | **Partly** | Unchanged. DP-01 (`x-tbd` in spec) |
| 11 | major | BA | **Partly** | Unchanged. DP-05/DP-06 |
| 12 | major | BA | **Open** | DP-10 (`x-tbd` on supplier fields) |
| 13 | major | BA / Architect | **Partly** | Rule committed (BRD v1.4) and markers in SSM (`1c15d5c`). The CFR ranges are stored as literals; see #27. Field scope and attestation on non-text writes still DP-03 |
| 14 | major | BA | **Partly** | Unchanged. DP-11 |
| 15 | major | BA | **Open** | DP-08 |
| 16 | major | Architect | **Partly** | Reset runbook (`3c6dbdf`, `6260965`). `EnvName` is still `AllowedValues [dev, stage, prod]` (`20-data.yaml:6`, `30-api.yaml:6`) and lean tables are still `Retain` (`20-data.yaml:17,47`), so there are no personal/PR envs |
| 17 | minor | Architect | **Resolved** (`813987a`) | reports-api 512 MB, `ENV_NAME`, origin param (`30-api.yaml:116-133`) |
| 18 | minor | Architect | **Resolved** (`813987a`) | `DependsOn` log groups. Inline logs scoped to own group; X-Ray `*` only in strict (required by X-Ray) |
| 19 | minor | Architect | **Resolved** (`3c6dbdf`) | Unchanged |
| 20 | minor | Architect | **Resolved** (`48000e6`) | Zero-padded `CH#<4-digit>`, one row + audit per transaction (overview §5.1 line 86) |
| 21 | minor | BA | **Open** | DP-12 |
| 22 | minor | BA | **Open** | DP-07 |
| 23 | minor | Architect | **Resolved** (`a2874e6`, `48000e6`) | Client-side ⌘K |
| 24 | minor | Architect | **Partly** | EMF contract is in `50-observability.yaml:122` and `src/shared` EMF in ADR-0014. Not yet written down: a "never log request bodies" rule and the log field schema |
| 25 | minor | Architect | **Resolved** (`48000e6`) | Overview §7 KMS line removed; `TransactWriteItems` clarified (line 103) |

**New findings**
26. **[major] The SecureString decrypt permission for the origin secret is unverified and likely missing.** Owner: **Architect.** `GetParameter` with `WithDecryption` on a SecureString encrypted with `aws/ssm` makes SSM call KMS with the caller's identity. Neither `RecordsApiRole`/`ReportsApiRole` (`30-api.yaml:30-95`) nor the boundary `SentinelQA-<env>-app-boundary` (`00-bootstrap.yaml:77-121`) grants `kms:Decrypt`. ADR-0015 itself says the boundary "may need" it. If decryption is refused, every request fails at the first middleware step, before the 403 check. Fix: add `kms:Decrypt` with `Condition: kms:ViaService = ssm.<region>.amazonaws.com` (Resource: the `aws/ssm` key ARN or `*` with the condition) to both roles **and** the boundary, then prove it in dev with a smoke test. Also ensure the deploy role has the same for the pipeline read (ADR-0015 notes this for InfraDeploy).
27. **[major] CFR range markers are stored as literals.** Owner: **Architect** (pattern format) with **BA** (DP-03 range semantics). `20-data.yaml:86` stores `22 CFR 120-130` and `15 CFR 730-774` as `StringList` items. Under the BR-44 v1.4 rule (whole-word, case-insensitive), a literal match only hits that exact text, not `22 CFR 121.1` or `15 CFR 774 Supp. 1`, which is what the decision intends. Fix: change the param to a JSON `String` of `{id, pattern}` entries (e.g. `\b22\s*C\.?F\.?R\.?\s*(?:Parts?\s*)?(12\d|130)\b`), let BA confirm the range semantics in DP-03, and add gate unit tests for each boundary (119/120/130/131, 729/730/774/775).
28. **[minor] The app-role boundary allows `ssm:PutParameter` on all env params.** Owner: **Architect.** `00-bootstrap.yaml:106-109`. Only the export watermark (`/sentinelqa/<env>/backup/last-export-to`) needs writes. Today the role policies don't grant it, but the boundary would let a future inline policy overwrite markers or the origin secret. Fix: scope `PutParameter` in the boundary to the watermark ARN.
29. **[minor] Quality records carry two dates but only one is indexed.** Owner: **Architect.** Overview §5.1 maps the QR `dueAt` to `needByDate` (BR-15). The review queue's "days left" (BR-14, US-11) uses the record's due date, which is read from the item, so this works. But "overdue CAPA/NCMR" has no index. Fix: confirm that's intended, or add `WS#ws#DUE#QR-RESPONSE` entries.

**Owner totals (29 findings):** BA 9 primary (#4, #10, #11, #12, #13, #14, #15, #21, #22; #27 shared). Architect 20 (#1–3, #5–9, #16–20, #23–29).
**Status totals:** Resolved 13 (#1, #2, #3, #5, #6, #7, #8, #17, #18, #19, #20, #23, #25). Partly 9 (#4, #9, #10, #11, #13, #14, #16, #24, #26 after `48beba3`, see addendum). Open 7 (#12, #15, #21, #22, #27, #28, #29).
**Blockers:** #1, #2, #3 closed. **#4 remains** (BA, waiting on DP-02 from Vishwas).

**Developer actions (additions; code still waits for Vishwas's go-ahead):** emit `ControlledDataBlocked` via Powertools Metrics EMF with namespace `SentinelQA` and dimension `Env` exactly; implement the origin check with a 5-minute SSM cache, constant-time compare and comma-separated rotation list (ADR-0015); add a dev smoke test that cold-starts both functions and decrypts the SecureString (#26); add a CI step that runs `gen-routes.py` and `git diff --exit-code`, plus `openapi-spec-validator`.

### Addendum: InfraDeploy `48beba3` and `9fdfac1` (verified at HEAD)
- `cfn-lint` re-run on all 8 templates after these commits: **0 errors, 0 warnings**.
- **`48beba3`, verified.** `params/*.json` drop `ArtifactBucket`, and the account/region values move under `_meta`. The origin secret is documented as a pipeline NoEcho override, not stored in params. `00-bootstrap.yaml` adds two things:
  - Boundary statement `AllowSsmSecureStringDecrypt`: `kms:Decrypt` on `key/*` with `kms:ViaService=ssm.<region>.amazonaws.com` and `ForAnyValue:StringEquals kms:ResourceAliases = alias/aws/ssm`.
  - Deploy-role statements `ReadOriginVerifySecret` (GetParameter on exactly `/sentinelqa/<env>/edge/origin-verify`) and `DecryptOriginVerifySecret` (same KMS conditions plus `kms:EncryptionContext:PARAMETER_ARN` pinned to that parameter).
- **`9fdfac1`, verified.** The first-deploy runbook now orders ADR-0015 rotation as dual value, then distribution update, then single value (zero downtime).
- **#26 is now Partly.** The boundary and deploy role allow the decrypt. However, `RecordsApiRole`/`ReportsApiRole` (`30-api.yaml:30-95`) still grant **no** `kms:Decrypt`, and the line 29 comment still says "no kms:* permissions needed". A boundary only caps permissions; it doesn't grant them. Whether the `aws/ssm` key policy alone authorises the Lambda roles has not been verified. Fix (Architect): add the same conditioned `kms:Decrypt` (ViaService ssm, ResourceAliases `alias/aws/ssm`, ideally `kms:EncryptionContext:PARAMETER_ARN` = the origin-verify param) to both function roles, update the comment, and prove it with the dev smoke test.

**Open items from InfraDeploy (carried here, owner InfraDeploy):**
1. CI/CD pipeline (GitHub Actions workflow: lint → build → upload `<sha>/<fn>.zip` → change set → approval → execute, plus the gen-routes drift check) is not committed.
2. The dev/stage **table-reset role** used by the runbook/script (`docs/runbooks/nonprod-table-reset.md`, `scripts/reset-nonprod-tables.sh`) isn't defined in any template yet.
3. The `kms:ResourceAliases` condition (`00-bootstrap.yaml`, boundary and deploy role) is **unverified** against an AWS managed key in a live account. If it doesn't evaluate as expected, every SecureString read fails. Verify in dev with `aws ssm get-parameter --with-decryption` under the deploy role and a Lambda smoke test. Fall back to `kms:ViaService` + `EncryptionContext` only if needed.

**Developer action (origin-verify middleware, refines the earlier item; code still waits for Vishwas's go-ahead):**
- Read `/sentinelqa/<env>/edge/origin-verify` with `WithDecryption`, cache it for **at most 5 minutes**, and **split the value on commas** (trimmed, empties dropped) so dual-value rotation (ADR-0015, `9fdfac1`) works.
- Compare the incoming `X-Origin-Verify` against **each** accepted value. **SHA-256 hash both the header and each candidate first**, then compare the 32-byte digests with `crypto.timingSafeEqual`. `timingSafeEqual` throws on unequal lengths, so comparing raw strings would turn a wrong-length header into a 500; hashing keeps every mismatch a **403** `forbidden_origin` (problem+json) and doesn't leak the length.
- A missing header or no match returns 403 before any other middleware. The header and secret are never logged.
- If the SSM read itself fails, return 503/500 with an alarmable log, not 403, so misconfiguration (e.g. #26) is visible.

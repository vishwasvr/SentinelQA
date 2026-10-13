# SentinelQA — AWS Architecture Overview

| Item | Value |
|---|---|
| Status | **v0.5: D-01..D-14 (D-03 amended by O-08) + environment profiles ([ADR-0013](adr/0013-environment-profiles.md)); peer-review changes 2026-10-13 (API contract, build ADR-0014, origin header ADR-0015, GSI/access patterns, backup health alarm, permissions boundary).** Nothing deployed and no AWS resources created |
| Basis | [BRD v1.4.1](../requirements/BRD.md) (commit ff3fd01, BR-44 CFR ranges; v1.4 a2874e6: Vishwas decisions on BR-31/45, US-41, BR-47, BR-44; pending DP-01..DP-20 in §13.3, v1.4.2 2374e7e), incl. rules BR-44..BR-47; screenshots 01–58, reliability CSV |
| Diagrams | [diagrams.md](diagrams.md) · API: [api/openapi.yaml](api/openapi.yaml) (OpenAPI 3.1) · Decisions: [adr/](adr/) · IaC: [iac/README.md](iac/README.md) (CloudFormation) · Cost: [cost-estimate.md](cost-estimate.md) |

> Scope: only BRD-observed behavior. **AI features are deferred (D-01)**. The current build has no model provider. An `ai` seam is reserved (§6). Auth, logins and multi-tenancy are out of scope, with seams kept ([ADR-0008](adr/0008-auth-and-tenancy-ready-seams.md)). Roadmap items are not designed.

## 1. Drivers from the BRD
| Driver | BRD | Consequence |
|---|---|---|
| Human is reviewer of record | BR-09 | Records carry named reviewer/approver fields. All state changes are human-initiated |
| Controlled-data gate | BR-04/05, **BR-44**, US-02, US-15 | Kept server-side on every free-text write (attestation + keyword block, [ADR-0005](adr/0005-controlled-data-gate-enforcement.md)) |
| Server-side persistence, 7-year retention **in prod** | **BR-45**; D-03 as amended by O-08 (overrides demo browser-only, OQ-04) | DynamoDB with no TTL on records/audit, deletion protection, RETAIN policies |
| No file storage | BR-07 | References only ([ADR-0007](adr/0007-references-only-no-file-storage.md)) |
| Immutable audit trail | BR-08, BR-36, **BR-46** | Append-only DynamoDB + IAM explicit deny (D-05). No WORM archive |
| Segregation of duties by named person | BR-10/20/33/35/37 | Domain-logic checks. Advisory until auth exists |
| Sample data in every env | **BR-31**, BR-45 (v1.4) | Seed set flagged `isSample`, labelled "ILLUSTRATIVE — SAMPLE RECORDS" (§5.2) |
| Configurable thresholds | **BR-47** (BR-16/18/25, training); D-07, OQ-01/02 | SSM parameters with **PLACEHOLDER** defaults (BRD v1.4), tuned later (DP-16) |

## 2. In scope for the current build vs deferred
| Module (BRD §4) | Current build | Deferred (AI, D-01) |
|---|---|---|
| Records / CAPA / NCMR / SCAR | Create forms, 6-stage workflow, disposition + independent approver, timeline, filters, status board, review queue sort, trends | "Start my CAPA" paste-to-draft, "Continue drafting in the agent" |
| Supply Chain | Scorecard with **deterministic** score from configurable weights (D-07) | AI risk narrative |
| Supplier Qualification | 6-step wizard, approver gate, ASL, re-eval tracking | AI risk hypotheses |
| Purchase Controls | Stored PO check records (manual entry) | "Check clauses" AI check |
| FAI | Form 1, Form 3 grid, preparer/evaluator sign-off | "Build my FAI record" |
| Calibration, Training, Document Control, Approval Roles | Full CRUD and rules per BRD | — |
| QMS Champion | Ratings, mean score, top gaps (deterministic, BR-41) | "Ask the agent … gap-closure plan" |
| Dashboard | Needs-attention aggregation (BR-42) | — |
| Ask the agent, /demo, /try-your-document, Agent reliability | — (/demo and /try-your-document static pages per DP-18; agent hidden) | Entire modules, AgentTask table, reliability alarms (BR-29/30/43) |

## 3. Services
| Layer | Service | Purpose |
|---|---|---|
| Edge | CloudFront (+ WAF **deferred**, D-11) | SPA + `/api/*` routing. Baseline: API Gateway throttling only |
| Static | S3 (private, OAC, Block Public Access) | SPA bundle |
| API | API Gateway HTTP API | Explicit routes generated from [api/openapi.yaml](api/openapi.yaml) (`iac/tools/gen-routes.py`), stage throttling. Default endpoint guarded by the CloudFront `X-Origin-Verify` header ([ADR-0015](adr/0015-origin-verify-header.md)) |
| Compute | Lambda, **Node.js/TypeScript** (D-06, D-09) | `records-api` (CRUD, workflow, SoD, controlled-data gate), `reports-api` (dashboard aggregates, trends) |
| Data | DynamoDB on-demand. Prod: PITR, AWS managed key `aws/dynamodb`, deletion protection. Non-prod: AWS owned key, no PITR | `Domain` table + `AuditLog` table |
| Backup (prod) | DynamoDB incremental export → S3 (SSE-S3) → Glacier Flexible Retrieval, 7-year lifecycle; EventBridge Scheduler + export Lambda (monthly export, daily verify + `ExportHealthy` heartbeat alarm) | O-01, `25-backup` stack |
| Config | SSM Parameter Store | Risk weights/bands and due-soon thresholds (**PLACEHOLDER** defaults, BR-47), controlled-data marker list, origin-verify SecureString |
| Observability | CloudWatch Logs/metrics/alarms → **SNS email** (D-10) | Lambda errors, API 5xx, DynamoDB SystemErrors (per operation), gate blocks (EMF), backup health |
| Governance | CloudTrail, Budgets | Account baseline |
| CI/CD | GitHub Actions + OIDC → deploy role (D-12), repo `vishwasvr/SentinelQA`, environments dev/stage/prod (prod: required reviewer), account 723940054516 | `cfn-lint`, esbuild bundles at `<sha>/<function>.zip` ([ADR-0014](adr/0014-build-packaging.md)), change sets, manual approval for prod |
| Deferred | Bedrock, Cognito, WAF, digest (EventBridge/SES) | Seams only |

## 4. Data flow and API conventions (current build)
The contract is [api/openapi.yaml](api/openapi.yaml) (OpenAPI 3.1, BRD v1.4). Fields fixed by Vishwas's 2026-10-13 decisions carry `x-decision: DP-nn` (details in [dp-proposals.md](../requirements/dp-proposals.md)); only OQ-08 (FAI Form 2) remains `x-tbd`.
1. The SPA calls CloudFront, e.g. `POST /api/quality-records` with `Idempotency-Key`, body `{ ..., controlledDataAttestation: true, actorName }`. CloudFront adds `X-Origin-Verify`.
2. Middleware order: **origin header check** (403 `forbidden_origin`, ADR-0015) → workspace (`aerospace`) → **controlled-data gate (BR-44)** on free-text fields: missing attestation → 400 `gate:attestation_required`; marker hit (keywords whole-word, case-insensitive, SSM `controlled-data/markers`; CFR ranges via one citation-finding regex (title, `CFR`, optional `Part` or `§`, part number, optional `.section`) followed by a code check of the part number against the structured ranges in SSM `/sentinelqa/<env>/controlled-data/cfr-ranges` (`[{title:22,partFrom:120,partTo:130},{title:15,partFrom:730,partTo:774}]`). Any citation inside a range matches (e.g. `22 CFR 121.1`, `22 CFR Part 126`, `15 CFR § 774.1`), and the literal range text `22 CFR 120-130` still matches. Defined in BR-44, BRD v1.4.1 (ff3fd01); Signed off by Vishwas (DP-03, 2026-10-13); input is normalised first (NFKC, case-fold, collapsed whitespace, `.`/`-`/`_` between letters treated as separators). Reference check: `iac/tools/test_marker_patterns.py`) → 422 `gate:controlled_marker`. Nothing is persisted and no audit event is written. Only the marker id is logged; the matched text never is. The gate metric `SentinelQA` / `ControlledDataBlocked` {`Env`} is emitted via EMF (Powertools Metrics). Request bodies are never logged.
3. Domain validation (BR-17/22/23/26/35/37; SoD per DP-08) → errors as `application/problem+json`.
4. `TransactWriteItems` (`ClientRequestToken` = Idempotency-Key) puts or updates the item with `ConditionExpression version = :expected` (`If-Match`, 412 when stale, 428 when missing), and stage moves are also conditional on `stage = :from` (409). It appends an `AuditLog` put (`attribute_not_exists`) holding actor, event, from/to stage, snapshot and `controlledDataAttested`. The idempotency record is kept 24 h.
5. **Soft delete everywhere** (BRD v1.4 §13.1): DELETE sets `deletedAt` plus a `DELETED` audit event. Undo is a reversal event. Lists, counts and pickers exclude deleted items. `DeleteItem`/`BatchWriteItem` are denied on both tables in **every** environment.
6. Lists use cursor pagination (`limit` ≤ 100, opaque `cursor`). Reads compute derived status from dates and the SSM thresholds. The timeline is `GET /api/audit/{entityType}/{id}/events` (read-only Query on AuditLog).
7. Not routed: `/api/ai/*` (AI seam) and `/api/search`. ⌘K is **client-side over loaded lists** (US-41, BRD v1.4).

### 4.1 Logging rule (architecture rule, Developer review #24)
Applies to every Lambda (`records-api`, `reports-api`, backup functions). Code is frozen; this is the contract for when it starts.
- **Never log:** request or response bodies; any header value carrying a secret (`X-Origin-Verify`, `Authorization`, cookies); record field values (titles, descriptions, names, free text, matched gate text); SSM parameter values. Query strings are not logged either, only the route template.
- **Format:** one JSON object per line via Powertools Logger, these fields only:

| Field | Meaning |
|---|---|
| `ts` | ISO 8601 UTC timestamp |
| `level` | `DEBUG` / `INFO` / `WARN` / `ERROR` (`DEBUG` off in strict) |
| `env` | `dev` / `stage` / `prod` (`ENV_NAME`) |
| `fn` | function name, e.g. `SentinelQA-<env>-records-api` |
| `requestId` | API Gateway request id (also the Lambda request id where present) |
| `route` | route template, e.g. `GET /api/quality-records/{id}` (never the raw path) |
| `method` | HTTP method |
| `status` | HTTP status returned |
| `latencyMs` | handler duration in ms |
| `errorCode` | problem code when not 2xx, e.g. `forbidden_origin`, `gate:controlled_marker` |
| `markerId` | gate only: `K<n>` / `R<n>` (ADR-0005), never the matched text |
| `workspaceId` | only if present (tenancy seam, ADR-0008) |
| `entityId` | optional record id (opaque id, not field values) |

Powertools Logger default keys (`service`, `cold_start`, `function_arn`, `xray_trace_id`, `sampling_rate`) are also allowed; they carry no PII or record data.

- No PII and no body in any field. Stack traces only at `ERROR`, with messages that do not echo input. Metrics stay EMF (§4 step 2).

### 4.2 Runtime config: caching and failure handling (architecture rule, QA-31)

All SSM parameters under `/sentinelqa/<env>/` are read through one config loader (Powertools Parameters), cached per Lambda instance for **5 minutes** (same TTL as the origin-verify secret, ADR-0015). A changed value therefore takes effect within 5 minutes, with no redeploy. If a refresh fails, the last good cached value is kept until the instance is recycled. A cold start with no cached value follows the rules below.

| Parameter | Missing or unreadable | Malformed (fails schema check) |
|---|---|---|
| `edge/origin-verify` | Fail closed: 403 `forbidden_origin` on every request | Same as missing |
| `controlled-data/markers`, `controlled-data/cfr-ranges` | **Fail closed:** writes that carry free text get 503 `config_unavailable`; reads still work. The gate never runs with an empty list | Same as missing (e.g. a range with `partFrom > partTo` or a non-integer title) |
| `supplier-risk/weights` (DP-16), `due-soon-days`, `capa-ncmr/default-due-days` (DP-20), `workspace/timezone` (DP-12) | The affected routes return 503 `config_unavailable`; other routes still work. No silent built-in defaults | Same as missing. Checks: weights sum to 1 ±0.001, bands sorted by `min`, day values are positive integers, timezone is a valid IANA name |

Every failure logs `errorCode=config_unavailable` with the parameter **name** only, never its value (§4.1). It also emits the EMF metric `SentinelQA`/`ConfigErrors` {`Env`}, which goes into the existing 5xx/error alarm. Test hooks: unit tests feed the loader missing, unreadable and malformed values and check the status codes above.

## 5. Data model (BRD §6)
Single table `SentinelQA-<env>-Domain`, every PK prefixed `WS#<workspaceId>` (tenancy seam). **No TTL**. Prod retained ≥ 7 years (D-03, amended: prod only, O-08). Prod may also hold labelled sample records (BR-31). Dev/stage hold synthetic or labelled sample data only, never real customer records (BR-45).

| BRD entity | PK / SK | Notes |
|---|---|---|
| Quality record (CAPA/NCMR/SCAR) | `WS#ws` / `QR#<id>` | type, title, description, severity, stage, clause, dueDate, needByDate, reviewerName, disposition, independentApprover, sourceRecordId (OQ-23). GSI1 stage/severityRank#openedAt (BR-14), GSI2 dueDate (due / overdue), GSI3 needByDate (BR-15) |
| Audit event | `AuditLog`: `WS#ws#ENT#<id>` / `<ts>#<ulid>` | actor {name, userId:null}, eventType, snapshot, controlledDataAttested, prevHash (optional tamper signal) |
| Supplier | `WS#ws` / `SUP#<id>` | onTimePct, openScarCount, criticality, certRenewalDate. Score computed from SSM weights (D-07) |
| Supplier qualification | `WS#ws` / `SQ#<id>` | stage, scope, approverName, approvalDate, reevalDate (GSI2) |
| PO clause check | `WS#ws` / `PO#<id>` | findings[] entered manually (AI check deferred) |
| FAI Form 1 / Form 3 | `WS#ws` / `FAI#<uuid>`, `FAI#<uuid>#CH#<n>` | preparer ≠ evaluator (BR-33) |
| Calibration instrument | `WS#ws` / `CAL#<id>` | certRef*, nistStatement*, nextDue (GSI2) |
| Training assignment | `WS#ws` / `TRN#<id>` | sourceRecordId, dueDate, completedDate |
| Controlled document | `WS#ws` / `DOC#<docNo>#REV#<rev>` | supersede in the same transaction (BR-37) |
| Approval role | `WS#ws` / `ROLE#<id>` | not authz (BR-19) |
| Maturity assessment | `WS#ws` / `QMS#<id>` | ratings[8], mean (BR-41) |
| Agent task, alert rule | **Deferred** with AI | Table not created |

### 5.1 Access patterns and GSIs
| Pattern | Index | Key condition | Notes |
|---|---|---|---|
| List an entity type | table | `PK=WS#ws`, `begins_with(SK,'<TYPE>#')` | Filter `attribute_not_exists(deletedAt)`. Projection: lists return summary fields |
| Review queue (BR-14) | **GSI1 (sparse)** | `GSI1PK=WS#ws#REVIEWQ` | `GSI1SK=<severityRank>#<openedAt>` (Critical=1). Written only while the record is awaiting review; stages per DP-02, oldest `openedAt` first (DP-13, decided). Major=2, Minor=3 |
| Need-by "Threatens delivery" (BR-15) | **GSI3 (sparse)** | `GSI3PK=WS#ws#NEEDBY`, `needByAt <= :today+14d` | Open CAPA/NCMR with a `needByDate` only. Removed on close/soft delete |
| Due / overdue / re-eval / next-due (quality records, BR-18/25, training) | **GSI2 (sparse)** | `GSI2PK=WS#ws#DUE#<entityType>`, `dueAt <= :date` | `dueAt` copied from each entity's own date (below). Removed on close/complete/soft delete |
| Timeline | AuditLog | `PK=WS#ws#ENT#<id>` | Ascending SK |
| FAI Form 3 rows | table | `PK=WS#ws`, `begins_with(SK,'FAI#<uuid>#CH#')` | `CH#<zero-padded 4-digit charNo>`. One row + its audit event per transaction (dev #20) |

**`dueAt` mapping (sparse: set only while the item is open/active):** Quality record → `dueDate` ("days left (due)", BRD §6, open CAPA/NCMR, so `dueAt < :today` lists overdue ones; `needByDate` goes to GSI3, dev #29). **DP-20 decided (2026-10-13):** `dueDate` is set at create to open date + N days (N from SSM `capa-ncmr/default-due-days`, PLACEHOLDER), so `dueAt` exists from step 1; a non-Closed record with `dueAt` before today (America/New_York) is Overdue and counts in Needs attention · Supplier qualification → `reevalDate` (Active on ASL, BR-18) · Calibration → `nextDueDate` (BR-25) · Training → `dueDate` (until completed) · Document → `nextReviewDate` (only when set; reminders not observed, OQ-17).

### 5.2 Sample data seed (BR-31, BRD v1.4: allowed in every env incl. prod)
- A versioned seed set (`seed/sample-v<n>.json`, synthetic only) is loaded by a **one-off seed command** (`npm run seed -- --env <env>`), run through the normal `records-api` write path, so the gate, validation and audit apply. Each item carries `isSample=true`. The SPA labels these items "ILLUSTRATIVE — SAMPLE RECORDS" (plus the DEMO badge where observed).
- Seed IDs are deterministic (the idempotency key is derived from the seed id), so re-runs are no-ops. The audit events carry `actorName="seed"` and event type `CREATED`. They are real append-only events: in prod they stay for 7 years like any other event.
- **Removal is a soft delete** (`deletedAt` + `DELETED` event), never a hard delete, in every env. In dev/stage, a full reset with InfraDeploy's [reset runbook](../runbooks/nonprod-table-reset.md) is followed by a seed re-run. Prod never gets resets.
- Reports and KPIs can include or exclude `isSample` items. The default follows the observed UI (samples counted). **Which way is TBD (OQ-10, partially answered).**

## 6. AI seam (deferred, D-01)
- Reserved API path `/api/ai/*` (not routed). Reserved package `src/ai/` with a `DraftProvider` interface (`draft(taskType, text) → {draft, citations[], confidence}`) and no implementation.
- Domain records already allow `draft` and `aiAssisted:false` fields, and the audit log reserves event types `AI_DRAFT_ACCEPTED/MODIFIED/REJECTED`.
- When AI is re-enabled, re-open [ADR-0004](adr/0004-ai-provider.md) (provider) and D-04 (prompt retention), and add the `AgentTask` table plus the BR-30 alarms.

## 7. Security / IAM (single account, D-08)
- Environments are separated **by name prefix** `SentinelQA-<env>-*`. Every IAM policy is scoped to ARNs containing its own env prefix. Resources are tagged `env`, and deploy roles carry an `aws:ResourceTag/env` condition where supported.
- `records-api` role: GetItem/Query/PutItem/UpdateItem/ConditionCheckItem on its own Domain table + indexes (`TransactWriteItems` is authorised per contained action; there is no separate IAM action). On AuditLog: PutItem (conditional, in code) plus **read-only GetItem/Query** for the timeline. **Explicit deny** of `UpdateItem/DeleteItem/BatchWriteItem` on AuditLog and of `DeleteItem/BatchWriteItem` on Domain, **in every environment** (soft delete, §4). `ssm:GetParameter(s)` on `/sentinelqa/<env>/*`. Logs only to its own log group. X-Ray in strict. No `kms:*` (O-09).
- `reports-api`: read-only on its env Domain table.
- **Permissions boundary:** every app role (records-api, reports-api, ddb-export, scheduler) sets `PermissionsBoundary` = `SentinelQA-<env>-AppRoleBoundaryArn` (InfraDeploy `00-bootstrap`). The CloudFormation execution role can only create roles with that boundary.
- GitHub OIDC deploy role per env: trust restricted to `repo:<org>/SentinelQA:environment:<env>`. Permission to manage only `SentinelQA-<env>-*` stacks.
- **Single-account risk:** a principal with admin rights can affect all envs. Mitigation is a naming/tag discipline and separate deploy roles. Revisit before handling real customer data (open item O-03).
- TLS only, S3 Block Public Access, CloudTrail on. **Encryption at rest (O-09): no customer-managed KMS keys anywhere.** Prod DynamoDB uses the AWS managed key `aws/dynamodb`; prod/non-prod S3 buckets use SSE-S3; SNS uses `alias/aws/sns`; dev/stage DynamoDB uses the AWS owned key ([ADR-0013](adr/0013-environment-profiles.md)). Trade-offs: no custom key policy, no customer-controlled rotation schedule (AWS rotates managed keys automatically), and the key cannot be disabled to crypto-shred data; CloudTrail still logs use of `aws/dynamodb`. KMS API requests to AWS managed keys are billed ($0.03/10k, within 20k/month free at 20 users). No `kms:*` IAM permissions or key policies are needed.
- No user identity yet: `actorName` is self-asserted (BR-11). SoD is advisory.

## 8. Retention (D-03 as amended by O-08)
- **Prod:** records and audit events kept **≥ 7 years**. No TTL, `DeletionProtectionEnabled`, `DeletionPolicy/UpdateReplacePolicy: Retain`, PITR on (35 days, also required for exports).
- **Dev/stage:** synthetic or labelled sample data only ("ILLUSTRATIVE — SAMPLE RECORDS"), never real customer records (BR-45, BR-31 v1.4). Full table resets only via the InfraDeploy [reset runbook](../runbooks/nonprod-table-reset.md). No retention obligation, no PITR, no backup. Real customer records must never be loaded there.
- **Long-term backup (O-01, decided):** a monthly job (EventBridge Scheduler, day 2) runs a Lambda that issues DynamoDB **incremental exports** for the previous month. Each export window is ≤ 24 h (an API limit), so a month is about 30 windows per table, all inside the 35-day PITR window. Exports land in S3 (SSE-S3, versioned), move to Glacier Flexible Retrieval after 1 day, and expire after 2,557 days (≈ 7 y). A one-time full export is the baseline. Not WORM, consistent with D-05.
- CloudWatch Logs retention: 30 days in prod, 7 days in dev/stage (logs contain no record content). O-02 decided 2026-10-13.

## 9. Cost drivers
Detailed estimate with sources, split by prod and non-prod: **[cost-estimate.md](cost-estimate.md)**. At 20 users, year 1 (v0.5): prod ≈ $3.09, non-prod ≈ $2.63, combined ≈ $5.72 without free tier (≈ $0.60 / $0.06 / $0.66 with always-free). Year 7 combined ≈ $7.91 / $1.54.

Near zero at pilot volume: Lambda, API GW, DynamoDB on-demand, S3/CloudFront. Fixed: CloudWatch alarm metrics (12 total: 10 prod + 1 per lean env; 2 over the 10 free), 4 EMF custom metrics (within 10 free), CI minutes. No KMS key fees (O-09). DynamoDB storage grows linearly over 7 years (small). Bedrock and WAF costs are gone for now.

## 10. Environments
Profiles per [ADR-0013](adr/0013-environment-profiles.md): `EnvProfile=lean` for dev/stage (synthetic or labelled sample data only, never real customer records; **admin full-table resets allowed**, via the [reset runbook](../runbooks/nonprod-table-reset.md), per BR-46 v1.2.2 / C-1; item-level audit update/delete still denied; AWS owned keys, no PITR/backup, 7-day logs, 1 alarm) and `EnvProfile=strict` for prod (AWS managed key, PITR, deletion protection, 7-year retention, 30-day logs, 7 alarms (10 alarm metrics) incl. export-errors and backup-health, monthly incremental export backup with a daily verify).

dev / stage / prod as stack sets in **one AWS account, us-east-1**. Stack names `SentinelQA-<env>-<Stack>`, parameters per env file (`iac/params/<env>.json`). GitHub Actions: lint → create change set → manual approval (stage/prod) → execute.

## 11. Assumptions
A-01 pilot-scale volume. A-02 SPA is a static bundle. A-03 only person names as PII. A-04 single workspace. A-06 free-text payloads ≤ 32 KB. A-07 English, US users. A-10 the AI-dependent public pages (/demo, /try-your-document) stay static pages in this build (DP-18, decided 2026-10-13). "Simulate second reviewer" is removed from the build (DP-05, decided 2026-10-13); SoD checks use real distinct reviewers only.

## 12. Decisions (resolved 2026-10-13)
| ID | Decision | Resolved value | ADR |
|---|---|---|---|
| D-01 | AI provider | **Deferred**. AI features out of scope. Seam kept | [0004](adr/0004-ai-provider.md) (Deferred) |
| D-02 | Region | **us-east-1 commercial** | [0009](adr/0009-region-and-accounts.md) |
| D-03 | Persistence/retention | **Server-side; 7 years for records and audit — prod only (amended 2026-10-13, O-08); dev/stage synthetic data** | [0003](adr/0003-datastore.md) |
| D-04 | Prompt retention | **N/A** (AI deferred) | [0004](adr/0004-ai-provider.md) |
| D-05 | Audit immutability | **DynamoDB append-only + IAM deny; no Object Lock** | [0006](adr/0006-immutable-audit-log.md) |
| D-06 | Compute | **Lambda** | [0002](adr/0002-serverless-compute.md) |
| D-07 | Weights/thresholds | **Configurable (SSM); values later** | overview §1 |
| D-08 | Accounts | **Single account; envs by stack/naming** | [0009](adr/0009-region-and-accounts.md) |
| D-09 | Runtime | **TypeScript (Node.js)** | [0002](adr/0002-serverless-compute.md) |
| D-10 | Alerts | **Email only (SNS)** | — |
| D-11 | WAF/CAPTCHA | **Deferred** | [0011](adr/0011-edge-protection-deferred.md) |
| D-12 | CI/CD | **GitHub Actions with OIDC** | [0012](adr/0012-ci-cd-github-actions-oidc.md) |
| D-13 | IaC | **Plain CloudFormation (YAML)**. CDK superseded | [0010](adr/0010-iac-cloudformation.md) supersedes [0001](adr/0001-iac-tool.md) |
| D-14 | Gate hit | **Block**. Attestation + keyword block kept server-side | [0005](adr/0005-controlled-data-gate-enforcement.md) |

**D-14 note:** the gate is *more* relevant without AI, not less. Free text (event descriptions, review notes, scope, PO findings) is now persisted for 7 years, and BR-04/05 already apply to the CAPA/NCMR create form. It applies to all free-text write endpoints.

## 13. Open items
- O-10, O-11, O-12: **Deferred** by Vishwas (2026-10-13) to the [pre-go-live checklist](#14-pre-go-live-checklist-prod).
- ~~O-08~~ **Resolved:** 7-year retention in prod only; dev/stage synthetic only.
- ~~O-09~~ **Resolved:** AWS managed keys, no CMKs anywhere.
- ~~O-01~~ **Resolved:** monthly job running daily-window incremental DynamoDB exports to S3 Glacier, 7-year lifecycle (`25-backup`).
- ~~O-02~~ **Resolved (Vishwas, 2026-10-13):** CloudWatch Logs retention 30 days prod, 7 days dev/stage.
- **O-03** Single-account blast radius. Revisit before production customer data.
- **O-04** Tuned values for D-07 (the PLACEHOLDER defaults ship, DP-16). Marker list decided in BRD v1.4, CFR ranges per v1.4.1 (ff3fd01) (incl. ITAR, EAR, CUI, `22 CFR 120-130`, `15 CFR 730-774`; whole-word, case-insensitive). CFR ranges are stored as structured ranges and checked in code (dev #27, §4); range reading signed off (DP-03). Normalisation, evasion scope and exempt fields decided (DP-03, 2026-10-13).
- ~~O-05~~ **Resolved (Vishwas, 2026-10-13):** without WAF (D-11), public endpoints rely on API Gateway throttling: HTTP API stage default route **rate 10 req/s, burst 20** (`ThrottleRate`/`ThrottleBurst` defaults in `30-api.yaml`; params files must match). Excess gets 429. Per-route overrides only if real traffic shows a need.
- **O-06** Whether hidden AI modules show a "coming later" state or are removed from navigation (UX).
- ~~O-13~~ **Resolved (Vishwas, 2026-10-13):** all DPs decided. DP-02/03/04/06–11/13/14/16/17/19 as recommended in [dp-proposals.md](../requirements/dp-proposals.md); DP-01 with soft-deleted IDs kept reserved (counter + reservation items in the same transaction as the record and audit event); DP-12 with timezone **America/New_York** (SSM `workspace/timezone`); DP-20 default `dueDate` = open + N days (PLACEHOLDER N). Reflected in `openapi.yaml` (`x-decision`) and 20-data SSM params.
- **O-07** BRD OQs still open (aligned with BRD v1.4 §12; OQ-10 partially answered by BR-31): OQ-03, 06, 07, 08, 09, 10, 14, 15, 17, 18, 21, 22, 23. OQ-05 is deferred with AI. OQ-13 is **closed** (attestation logged on audit events, §4 step 4 / ADR-0005). OQ-01/02/04 are resolved (BR-47 / BR-45).

## 14. Pre-go-live checklist (prod)
Complete before the prod go-live. Items deferred by Vishwas on 2026-10-13.

- [ ] **O-10** — *Deferred to pre-go-live (2026-10-13)* Restore runbook: DynamoDB *import from S3* reads full exports. Replaying incremental exports onto a restored baseline needs a custom job. Decide whether to also take a periodic (e.g. annual) **full** export to shorten the restore chain (≈ $0.10/GB per full export).
- [ ] **O-11** — *Deferred to pre-go-live (2026-10-13)* S3 lifecycle does not transition objects smaller than 128 KB by default (behaviour **unverified** in this review). Small export files may stay in S3 Standard. The cost impact is cents, but confirm.
- [ ] **O-12** — *Deferred to pre-go-live (2026-10-13)* Export bucket deletion protection: versioning only (no Object Lock per D-05). Decide whether to add a bucket-policy deny on `s3:DeleteObject*` for all principals except a break-glass role.
- [ ] **Stack protection:** enable termination protection on every `SentinelQA-prod-*` stack, and set a stack policy denying `Update:Replace`/`Update:Delete` on `DomainTable`, `AuditLogTable` and `ExportBucket` (see [iac/README.md](iac/README.md#prod-stack-protection)).
- [ ] **Go-live step: one-time FULL export** of the prod `Domain` and `AuditLog` tables (`ExportType=FULL_EXPORT`, PITR on) to the `25-backup` export bucket. This is the baseline for the monthly incremental exports, ≈ $0.10/GB of table size, ≈ $0 at go-live. Record the export time as the initial watermark (`/sentinelqa/prod/backup/last-export-to`).

## 15. BRD traceability (BR-44..BR-47; v1.4)
| BR | Design element | Status |
|---|---|---|
| BR-44 gate on all free-text saves (400 / 422, marker id only logged, `controlledDataAttested` on audit event) | §4 data flow, [ADR-0005](adr/0005-controlled-data-gate-enforcement.md), `CONTROLLED_GATE_MODE: block`, SSM marker list | Consistent. Matching rule and markers decided (BRD v1.4; CFR ranges v1.4.1, ff3fd01, cfr-ranges SSM); normalisation and exempt fields decided (DP-03) |
| BR-45 server-side persistence; prod ≥ 7 y; dev/stage synthetic only | §8, [ADR-0003](adr/0003-datastore.md), [ADR-0013](adr/0013-environment-profiles.md), 20-data Retain/no TTL, 25-backup | Consistent |
| BR-46 audit log append-only, IAM deny, corrections as new events, no WORM | §7 IAM, [ADR-0006](adr/0006-immutable-audit-log.md), 30-api deny statements (all profiles) | Consistent. C-1 **resolved** (BRD v1.2.2: covers app behaviour; prod strictly append-only; dev/stage full resets allowed) |
| BR-47 weights/bands and due-soon thresholds configurable (SSM) | §3 Config, 20-data SSM params (`supplier-risk/weights`, `due-soon-days` incl. training) | Consistent. PLACEHOLDER defaults in 20-data (BRD v1.4); band schema decided (DP-16); values still PLACEHOLDER |

**C-1: Resolved (2026-10-13, BRD v1.2.2, commit 9836af2).** Vishwas approved: BR-46 covers application behaviour. Single-event updates/deletes are denied in every environment (IAM explicit deny). Prod is strictly append-only (deletion protection + Retain). In dev/stage only, admins may do full table resets (synthetic data, BR-45).

**C-2: Resolved (BRD v1.2.1 fix, commit 281c2c2).** OQ-13 now cites architecture-overview §4 / ADR-0005.

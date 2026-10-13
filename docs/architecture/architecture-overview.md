# SentinelQA — AWS Architecture Overview

| Item | Value |
|---|---|
| Status | **Proposed (draft v0.1)**. Nothing deployed and no AWS resources created |
| Date | 2026-10-13 |
| Basis | [BRD v1.1](../requirements/BRD.md) (approved), screenshots 01–58, reliability CSV |
| Diagrams | [diagrams.md](diagrams.md) |
| Decisions | [adr/](adr/) · IaC outline: [iac/README.md](iac/README.md) |

> Scope rule: this design covers only behavior in the BRD. Roadmap items (weekly digest, certificate watch, ASL gate on POs, incoming inspection triage, etc.) are **not designed**. Where the design leaves room for them, it says so. Authentication, logins and multi-tenancy are out of scope (BRD §1.1), but the design keeps seams for them ([ADR-0008](adr/0008-auth-and-tenancy-ready-seams.md)).

## 1. Goals and constraints from the BRD
| Driver | BRD source | Architectural consequence |
|---|---|---|
| AI drafts, human is reviewer of record | §1, BR-09, US-01 | AI never changes a record's state. It returns a *draft* that a named person accepts, modifies or rejects. The decision is logged |
| Controlled-data gate (no ITAR/EAR/CUI) | BR-04/05, US-02/15, §9 | Gate is enforced on the **server**, not only in the UI ([ADR-0005](adr/0005-controlled-data-gate-enforcement.md)) |
| Pasted text not retained | BR-06, §9 | Prompt text is not persisted by default. Logs are redacted and the model provider gets no data retention. Conflicts with the home-page "output audit trail retains prompt" claim, see D-04 |
| No file storage, references only | BR-07, §4.10, §4.13 | No upload endpoint and no S3 bucket for user documents ([ADR-0007](adr/0007-references-only-no-file-storage.md)) |
| Immutable audit trail with actor + snapshot | BR-08, BR-36, §9 | Append-only audit store with deny-update/delete IAM, plus an optional WORM archive ([ADR-0006](adr/0006-immutable-audit-log.md)) |
| Segregation of duties by named individual | BR-10, BR-20, BR-33, BR-35, BR-37 | Enforced in domain logic on named-person fields. No real identity until auth exists (OQ-03) |
| Clause citations, hypothesis prefix, "clause reference to confirm" | BR-01..03 | Structured model output (JSON schema) plus a server-side validator. A violation is reported as `SCHEMA_MISMATCH` |
| Agent reliability KPIs, alerts, CSV export | §4.17, BR-29/30/43, US-32/39 | An `AgentTask` row per AI call, CloudWatch metrics/alarms, CSV export from the API |
| 30 s timeout, ~3 s average latency | BR-43, §4.17 | Synchronous Lambda path with a 30 s budget (API Gateway HTTP API limit is 30 s) |
| Low volume (single pilot) | §1 Pricing | Serverless, pay-per-use, scale to near zero |

## 2. Services (proposed)
| Layer | Service | Purpose |
|---|---|---|
| Edge | **CloudFront** + **AWS WAF** | Serves the SPA and routes `/api/*`. WAF applies managed rules and rate limiting (the public /demo and /try-your-document are unauthenticated) |
| Static web | **S3** (private, OAC) | SPA build (marketing + workspace) |
| API | **API Gateway HTTP API** | REST endpoints, 30 s integration timeout, throttling |
| Compute | **Lambda** (Node.js/TypeScript or Python, see D-09) | `records-api` (CRUD + workflow/SoD rules), `ai-gateway` (gate + Bedrock + validation), `audit-writer`, `reports-api` (reliability KPIs/CSV) |
| Data | **DynamoDB** (on-demand, PITR, KMS CMK) | Domain records (single table) + `AuditLog` table (append-only) + `AgentTask` table |
| Audit archive (optional) | **S3 Object Lock** (compliance mode) via DynamoDB Streams → Lambda/Firehose | WORM copy of audit events (D-05) |
| AI | **Amazon Bedrock** (proposed, D-01) + **Bedrock Guardrails** | Drafting with model invocation logging **off** for payloads |
| Data screening | Regex/keyword controlled-data screen in `ai-gateway`; optional **Amazon Comprehend** PII detection | Second line of the controlled-data gate |
| Secrets/keys | **KMS** CMKs per environment; **Secrets Manager** only if a non-Bedrock provider is chosen | Encryption and third-party API key |
| Observability | **CloudWatch** Logs (redacted), metrics (EMF), alarms, dashboards; **X-Ray** | BR-30 rules; channels via **SNS** → Email; Slack/PagerDuty through **AWS Chatbot**/HTTPS subscription (D-10) |
| Governance | **CloudTrail**, **AWS Config**, **IAM Access Analyzer**, **Budgets** | Account baseline |
| Future (not built) | Cognito / IAM Identity Center, EventBridge Scheduler + SES for the digest | Seams only |

## 3. Data flow
See [diagrams.md](diagrams.md) for the mermaid versions.

**A. Non-AI CRUD (e.g. register an instrument, BR-23..25)**
1. The SPA calls `POST /api/calibration-instruments`.
2. `records-api` validates (required fields, BR-23) and computes the derived ID (BR-39).
3. It writes the item and an audit event in one DynamoDB `TransactWriteItems` (record + `AuditLog` put with `attribute_not_exists`).
4. Derived status (Overdue/Due soon/Active) is **computed on read** from `nextDue` (BR-25), not stored, so it is never stale.

**B. AI draft (e.g. Start my CAPA, Check clauses)**
1. The SPA sends `{ module, taskType, text, controlledDataAttestation: true, actorName }`.
2. `ai-gateway`, **gate step 1**: reject with 400 if the attestation is missing or false (BR-04/05 server-side).
3. **Gate step 2**: deterministic screen for export-control/CUI markers (e.g. "ITAR", "EAR99", "ECCN", "CUI", "NOFORN", "Distribution Statement", "22 CFR 120", "export controlled"). Configurable list. A hit blocks the call with an explanation. No text is stored.
4. **Gate step 3**: Bedrock Guardrails (denied topics/word filters, PII masking) on input.
5. The model is invoked with a system prompt that enforces BR-01..03 and a JSON output schema.
6. **Output validation**: every claim has `clause` + `whyCitation`; ungrounded facts are prefixed `AI hypothesis — confirm:`; an unknown clause becomes `clause reference to confirm`. Failure → `SCHEMA_MISMATCH` (retry once).
7. Confidence below 0.75 or other escalation rules → status `escalated` (BR-29, OQ-18).
8. Write an `AgentTask` row (metadata only: module, task, status, latency, confidence, tokens, error_code, **no prompt text** unless D-04 decides otherwise).
9. Return the draft. It stays in the client or is saved as `draft` on the record. Prompt text is discarded.
10. The human accepts, modifies or rejects → `PATCH` the record → audit event `AI_DRAFT_ACCEPTED/MODIFIED/REJECTED` with actor + snapshot. The `AgentTask.decision` is updated (§4.17).

**C. Reliability (§4.17)**: `ai-gateway` emits EMF metrics (Tasks, Failures, Timeouts, LatencyMs, LowConfidence, Rejections). CloudWatch alarms implement the BR-30 rules. `reports-api` serves KPIs and `GET /api/agent-tasks.csv` (11 columns, US-39).

## 4. Data model mapped to BRD §6
Single-table DynamoDB design (`SentinelQA-<env>-Domain`). Every key is prefixed with `WS#<workspaceId>` so tenancy can be added without migration ([ADR-0008](adr/0008-auth-and-tenancy-ready-seams.md)). Today there is one workspace, `aerospace`.

| BRD entity | PK / SK | Key attributes (from BRD) | GSIs / notes |
|---|---|---|---|
| Quality record (CAPA/NCMR/SCAR) | `WS#ws` / `QR#<id>` | type, title, description, severity, stage, standard/clause, dueDate, needByDate, reviewerName, disposition (NCMR), independentApprover, draft, sourceRecordId (SCAR←NCMR, OQ-23) | GSI1 `WS#ws#QR#stage` / `severityRank#openedAt` (BR-14 sort); GSI2 needByDate (BR-15) |
| Audit timeline event | `AuditLog` table: `WS#ws#ENT#<entityId>` / `<ts>#<ulid>` | actor, eventType, fromStage, toStage, snapshot (JSON), controlledDataAttested (OQ-13) | Append-only (ADR-0006) |
| Supplier (risk scorecard) | `WS#ws` / `SUP#<id>` | name, commodity, criticality, onTimePct, openScarCount, certRenewalDate, standards[], narrative (AI draft), flags[], nextStep | Score computed in code. Weights are **unknown** (OQ-01, D-07) |
| Supplier qualification | `WS#ws` / `SQ#<id>` | supplierId, scopeRequested, approvedScope, stage, docReviewNotes, approverName, approvalDate, reevalDate | GSI reevalDate (BR-18) |
| PO clause check | `WS#ws` / `PO#<id>` | poNumber, supplier, part, qty, revision, findings[] {requirement,status,clause,suggestedWording,why}, counts | Stores the **result**, not the pasted PO text (BR-06) |
| FAI (Form 1) | `WS#ws` / `FAI#<uuid>` | partNumber*, partName*, revision, reportNumber, partType, faiType, reason, routingNo, status, preparerSig, evaluatorSig | BR-33 enforced (evaluator ≠ preparer) |
| FAI characteristic (Form 3) | `WS#ws` / `FAI#<uuid>#CH#<charNo>` | refLocation, designator, requirement, result, equipment, passFail, ncr | Form 2 not modeled (OQ-08) |
| Calibration instrument | `WS#ws` / `CAL#<id>` | name, assetNo, type, certRef*, lastCal, nextDue, calibratedBy, nistStatement* | Status derived (BR-25, OQ-02) |
| Training assignment | `WS#ws` / `TRN#<id>` | role, person, course, sourceRecordId, standard, dueDate, completedDate | Evidence/verifier not captured (BR-40) |
| Controlled document | `WS#ws` / `DOC#<docNo>#REV#<rev>` | name, type, location (link/text), effectiveDate, nextReview, status, releaseApprover | Supersede earlier released revs in one transaction (BR-37) |
| Approval role | `WS#ws` / `ROLE#<id>` | roleName, people[], defaultFor[] | Convenience only, **not** authz (BR-19) |
| Maturity assessment | `WS#ws` / `QMS#<id>` | ratings[8], overall (mean, BR-41), band, gaps | Persist or session-only: D-03 |
| Agent task | `AgentTask` table `WS#ws` / `<ts>#T-<id>` | module, task, status, latencyMs, confidence, decision, reviewer, tokens, errorCode | TTL per D-03. CSV export |
| Alert rule | Config (IaC/SSM parameters) + CloudWatch alarms | name, threshold, window, channel, enabled | Rule editing not observed (OQ-18) |

Sample/illustrative data (BR-31) is loaded by a seed script in dev/stage only and carries `isSample=true`.

## 5. Security and IAM (least privilege)
- **One role per Lambda**, scoped to its own tables and actions:
  - `records-api`: `dynamodb:GetItem/Query/PutItem/UpdateItem/TransactWriteItems` on the Domain table and its GSIs. `PutItem` only on AuditLog (condition `attribute_not_exists`). **No** `DeleteItem` anywhere in prod.
  - `ai-gateway`: `bedrock:InvokeModel` / `ApplyGuardrail` on **specific model/inference-profile ARNs and the guardrail ARN** only. `PutItem/UpdateItem` on AgentTask. `cloudwatch:PutMetricData` with a namespace condition.
  - `audit-archiver`: `dynamodb:GetRecords` on the AuditLog stream. `s3:PutObject` on the archive bucket only.
  - `reports-api`: read-only on AgentTask.
- An **explicit deny** on `dynamodb:UpdateItem/DeleteItem/BatchWriteItem` against AuditLog, applied in the role policy, plus an SCP in prod if AWS Organizations is used (D-08).
- KMS CMK per environment. Key policy limits use to the service roles. S3 Block Public Access, TLS-only bucket policies.
- No secrets in code. Bedrock uses IAM (no API key).
- WAF: AWS managed common/known-bad-inputs rule sets, IP rate limit on `/api/ai/*` (D-11 sets the limit). Body size cap, e.g. 32 KB (assumption A-06).
- CloudTrail (management events) in all environments. Data events on the audit bucket in prod.
- **Not provided yet:** no user identity. Every `actorName` is self-asserted as in the demo (BR-11). SoD is advisory until auth exists, and the docs must say so.

## 6. AI integration and data-handling controls
| Control | Implementation |
|---|---|
| Provider | Amazon Bedrock, proposed ([ADR-0004](adr/0004-ai-provider.md)). Decision **D-01** |
| No training on / retention of inputs | Bedrock does not use inputs to train models and does not store prompts. Keep **model invocation logging disabled**, or enabled to S3 with metadata only (D-04) |
| Data residency | Region us-east-1 proposed (D-02). Cross-region inference profiles may route within US regions; use them only if acceptable (D-02) |
| Controlled-data gate | 3 layers: (1) attestation required server-side, (2) deterministic marker screen, (3) Guardrails. Gate outcomes are logged as metadata (`gate=blocked:marker:ITAR`), never with the text. The UI checkbox stays as is (BR-04/05) |
| Output governance | JSON-schema output + validator for BR-01..03. Low confidence → escalate (BR-29). Draft label in the UI (BR-09) |
| Prompt/log hygiene | Lambda logs never contain request bodies (a structured logger with allow-listed fields) |
| Prompt management | Versioned system prompts in the repo (or Bedrock Prompt Management). `promptVersion` is recorded on each AgentTask |
| Timeouts | Model call budget 25 s, Lambda 29 s, API 30 s → `TIMEOUT_30S` (BR-43) |
| Errors | Map to BR error codes: `MODEL_5XX`, `RATE_LIMIT` (throttling), `TOOL_ERROR`, `SCHEMA_MISMATCH`, `TIMEOUT_30S` |

**Limits to be honest about:** a keyword screen cannot prove absence of controlled data. The gate lowers risk. The user's attestation stays the primary control, as on the current site. If SentinelQA must ever *accept* CUI/ITAR, this architecture is **not** sufficient: that would need GovCloud, US-person access controls and a different provider posture (D-02).

## 7. Cost drivers (indicative, not quoted)
| Driver | Notes |
|---|---|
| Bedrock tokens | Dominant variable cost. The BRD CSV has a `tokens` column per task. Cost scales with records/month × tokens × model price. Model choice (D-01) matters most |
| WAF | Fixed ~monthly per web ACL + rules + requests. Notable at pilot scale |
| CloudFront / S3 / API GW / Lambda / DynamoDB on-demand | Near zero at pilot volume |
| KMS CMKs | Fixed per key per month (×3 environments) |
| CloudWatch | Logs ingestion and alarms. Keep log retention short (D-03) |
| Guardrails / Comprehend | Per text unit. Optional layers |
| S3 Object Lock archive | Small, grows with audit volume and retention |
Use AWS Pricing Calculator after D-01/D-03. Budgets alarms per account.

## 8. Environments
| Env | Account (proposed) | Purpose | Differences |
|---|---|---|---|
| dev | separate AWS account | Developer iteration | Sample data seeded, cheaper/smaller model allowed, deletes allowed, short log retention |
| stage | separate account | Pre-prod, pilot rehearsal, validation evidence | Prod-like config, seeded sample data, synthetic data only |
| prod | separate account | Pilot customer | PITR, deletion protection, Object Lock, no delete IAM, WAF strict, alarms to real channels |
CI/CD (not built): GitHub Actions with OIDC → per-account deploy role, `cdk diff` on PR, manual approval for prod (D-12).

## 9. Assumptions (explicit)
- **A-01** Volume is small (single pilot, order of tens to hundreds of AI tasks/day, consistent with 240 tasks/~28 h in the CSV).
- **A-02** The SPA can be built as a static bundle (current site appears to be a client-rendered app). Hosting the existing front-end is assumed, not verified.
- **A-03** No PII beyond person names (reviewer/approver/trainee) is stored.
- **A-04** One workspace ("Aerospace AS9100D") until tenancy is in scope.
- **A-05** Synchronous AI calls fit the 30 s budget (average ~3 s observed).
- **A-06** Paste payloads are text up to ~32 KB.
- **A-07** English only. US-based users.
- **A-08** Alert channels (PagerDuty/Slack/Email) are integrations to wire later. Email via SNS is enough at first.
- **A-09** Server-side persistence of records is wanted at all. The current demo is browser-only (BR-06, OQ-04). See D-03.

## 10. Decisions needed from Vishwas
| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D-01 | AI provider/model (OQ-05) | Bedrock (Anthropic Claude / Amazon Nova / others) · direct Anthropic/OpenAI API · Azure OpenAI | Bedrock: IAM auth, no key management, data stays in AWS, Guardrails ([ADR-0004](adr/0004-ai-provider.md)). Model availability in us-east-1 **not verified**: the AWS CLI session had expired |
| D-02 | Region and partition | us-east-1 · us-east-2/us-west-2 · AWS GovCloud (US) | us-east-1 commercial, since controlled data is excluded. GovCloud only if CUI/ITAR will ever be accepted ([ADR-0009](adr/0009-region-and-accounts.md)) |
| D-03 | Persistence and retention (OQ-04) | Browser-only like the demo · server-side persistence · hybrid; retention for records, audit log, AgentTask, logs | Server-side records. Audit retention aligned with customer record-retention policy (AS9100 customers often require multi-year). **Needs your number** |
| D-04 | Prompt retention | Never store (BR-06) · store prompt+output for audit (home page "Output audit trail") · store hash only | Store output + SHA-256 of prompt, never raw prompt, until clarified |
| D-05 | Audit immutability strength | DynamoDB append-only + IAM deny · + S3 Object Lock WORM · QLDB-like ledger (QLDB is discontinued) | IAM deny now; Object Lock in prod |
| D-06 | Compute style | Lambda (proposed) · ECS Fargate · App Runner | Lambda ([ADR-0002](adr/0002-serverless-compute.md)) |
| D-07 | Supplier score weights/bands, "due soon" thresholds (OQ-01, OQ-02) | Product inputs, not observable | Make them configurable. You supply values |
| D-08 | AWS account structure | single account · Organizations with dev/stage/prod accounts | 3 accounts under Organizations |
| D-09 | Runtime language | TypeScript (same as CDK) · Python | TypeScript |
| D-10 | Alert channels | Email only · + Slack (AWS Chatbot) · + PagerDuty | Email first |
| D-11 | Public demo abuse limits | WAF rate limit value, CAPTCHA | Your call on throttling vs friction |
| D-12 | CI/CD and repo hosting for deploys | GitHub Actions OIDC · CodePipeline | GitHub Actions OIDC |
| D-13 | IaC tool | CDK · SAM · CloudFormation | CDK TypeScript ([ADR-0001](adr/0001-iac-tool.md)) |
| D-14 | Controlled-data screen list and behavior on hit | block · warn-and-confirm | Block |

## 11. BRD open questions that this design does not resolve
OQ-01/02 (configurable, D-07), OQ-03 (SoD is advisory until auth), OQ-04 (D-03), OQ-05 (D-01), OQ-06/07/08 (step contents unknown, so the schema is open with `draft` maps), OQ-10, OQ-13 (we *propose* logging the attestation flag on audit events), OQ-14 (ASL gate not built), OQ-15, OQ-17, OQ-18 (escalation rule set configurable), OQ-21 (print view = client-side render of the record; controlled-record status undecided), OQ-22 (single industry), OQ-23 (`sourceRecordId` link only).

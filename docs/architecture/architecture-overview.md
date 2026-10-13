# SentinelQA — AWS Architecture Overview

| Item | Value |
|---|---|
| Status | **v0.4: D-01..D-14 (D-03 amended by O-08) + environment profiles ([ADR-0013](adr/0013-environment-profiles.md), accepted). O-01/O-08/O-09 resolved 2026-10-13.** Nothing deployed and no AWS resources created |
| Basis | [BRD v1.2.2](../requirements/BRD.md) (commit 9836af2; BR-46 amended per C-1), incl. rules BR-44..BR-47; screenshots 01–58, reliability CSV |
| Diagrams | [diagrams.md](diagrams.md) · Decisions: [adr/](adr/) · IaC: [iac/README.md](iac/README.md) (CloudFormation) · Cost: [cost-estimate.md](cost-estimate.md) |

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
| Configurable thresholds | **BR-47** (BR-16/18/25, training); D-07, OQ-01/02 | SSM parameters, values TBD |

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
| Ask the agent, /demo, /try-your-document, Agent reliability | — (hidden or static "coming later") | Entire modules, AgentTask table, reliability alarms (BR-29/30/43) |

## 3. Services
| Layer | Service | Purpose |
|---|---|---|
| Edge | CloudFront (+ WAF **deferred**, D-11) | SPA + `/api/*` routing. Baseline: API Gateway throttling only |
| Static | S3 (private, OAC, Block Public Access) | SPA bundle |
| API | API Gateway HTTP API | REST endpoints, stage throttling |
| Compute | Lambda, **Node.js/TypeScript** (D-06, D-09) | `records-api` (CRUD, workflow, SoD, controlled-data gate), `reports-api` (dashboard aggregates, trends) |
| Data | DynamoDB on-demand. Prod: PITR, AWS managed key `aws/dynamodb`, deletion protection. Non-prod: AWS owned key, no PITR | `Domain` table + `AuditLog` table |
| Backup (prod) | DynamoDB incremental export → S3 (SSE-S3) → Glacier Flexible Retrieval, 7-year lifecycle; EventBridge Scheduler + export Lambda (monthly) | O-01, `25-backup` stack |
| Config | SSM Parameter Store | Risk weights/bands, due-soon thresholds, controlled-data marker list |
| Observability | CloudWatch Logs/metrics/alarms → **SNS email** (D-10) | Lambda errors, API 5xx, throttles, DynamoDB errors |
| Governance | CloudTrail, Budgets | Account baseline |
| CI/CD | GitHub Actions + OIDC → deploy role (D-12) | `cfn-lint`, change sets, manual approval for prod |
| Deferred | Bedrock, Cognito, WAF, digest (EventBridge/SES) | Seams only |

## 4. Data flow (current build)
1. The SPA calls e.g. `POST /api/quality-records` with `{ ..., controlledDataAttestation: true, actorName }`.
2. `records-api` middleware: resolve workspace (`aerospace`), then **controlled-data gate (BR-44)** on endpoints that accept free text. A missing attestation → 400. A marker hit → 422 (block, D-14). Neither the text nor the matched substring is logged. Only the marker id is logged.
3. Domain validation (BR-17/22/23/26/35/37, SoD).
4. `TransactWriteItems`: the record put/update plus an `AuditLog` put (`attribute_not_exists`) holding actor, event, from/to stage, snapshot and `controlledDataAttested`.
5. Reads compute derived status (calibration BR-25, training, re-eval buckets) from dates and SSM thresholds.

## 5. Data model (BRD §6)
Single table `SentinelQA-<env>-Domain`, every PK prefixed `WS#<workspaceId>` (tenancy seam). **No TTL**. Prod retained ≥ 7 years (D-03, amended: prod only, O-08). Dev/stage hold synthetic data only.

| BRD entity | PK / SK | Notes |
|---|---|---|
| Quality record (CAPA/NCMR/SCAR) | `WS#ws` / `QR#<id>` | type, title, description, severity, stage, clause, dueDate, needByDate, reviewerName, disposition, independentApprover, sourceRecordId (OQ-23). GSI1 stage/severityRank#openedAt (BR-14), GSI2 dueDate (BR-15) |
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

## 6. AI seam (deferred, D-01)
- Reserved API path `/api/ai/*` (not routed). Reserved package `src/ai/` with a `DraftProvider` interface (`draft(taskType, text) → {draft, citations[], confidence}`) and no implementation.
- Domain records already allow `draft` and `aiAssisted:false` fields, and the audit log reserves event types `AI_DRAFT_ACCEPTED/MODIFIED/REJECTED`.
- When AI is re-enabled, re-open [ADR-0004](adr/0004-ai-provider.md) (provider) and D-04 (prompt retention), and add the `AgentTask` table plus the BR-30 alarms.

## 7. Security / IAM (single account, D-08)
- Environments are separated **by name prefix** `SentinelQA-<env>-*`. Every IAM policy is scoped to ARNs containing its own env prefix. Resources are tagged `env`, and deploy roles carry an `aws:ResourceTag/env` condition where supported.
- `records-api` role: Get/Query/PutItem/UpdateItem/ConditionCheckItem/TransactWrite on its own Domain table + indexes. PutItem only on its AuditLog. **Explicit deny** of `UpdateItem/DeleteItem/BatchWriteItem` on AuditLog, and of `DeleteItem` on Domain in prod. `ssm:GetParameter(s)` on `/sentinelqa/<env>/*`. `kms:Decrypt/GenerateDataKey` on its env key.
- `reports-api`: read-only on its env Domain table.
- GitHub OIDC deploy role per env: trust restricted to `repo:<org>/SentinelQA:environment:<env>`. Permission to manage only `SentinelQA-<env>-*` stacks.
- **Single-account risk:** a principal with admin rights can affect all envs. Mitigation is a naming/tag discipline and separate deploy roles. Revisit before handling real customer data (open item O-03).
- TLS only, S3 Block Public Access, CloudTrail on. **Encryption at rest (O-09): no customer-managed KMS keys anywhere.** Prod DynamoDB uses the AWS managed key `aws/dynamodb`; prod/non-prod S3 buckets use SSE-S3; SNS uses `alias/aws/sns`; dev/stage DynamoDB uses the AWS owned key ([ADR-0013](adr/0013-environment-profiles.md)). Trade-offs: no custom key policy, no customer-controlled rotation schedule (AWS rotates managed keys automatically), and the key cannot be disabled to crypto-shred data; CloudTrail still logs use of `aws/dynamodb`. KMS API requests to AWS managed keys are billed ($0.03/10k, within 20k/month free at 20 users). No `kms:*` IAM permissions or key policies are needed.
- No user identity yet: `actorName` is self-asserted (BR-11). SoD is advisory.

## 8. Retention (D-03 as amended by O-08)
- **Prod:** records and audit events kept **≥ 7 years**. No TTL, `DeletionProtectionEnabled`, `DeletionPolicy/UpdateReplacePolicy: Retain`, PITR on (35 days, also required for exports).
- **Dev/stage:** synthetic data only. No retention obligation, no PITR, no backup. Real customer records must never be loaded there.
- **Long-term backup (O-01, decided):** a monthly job (EventBridge Scheduler, day 2) runs a Lambda that issues DynamoDB **incremental exports** for the previous month. Each export window is ≤ 24 h (an API limit), so a month is about 30 windows per table, all inside the 35-day PITR window. Exports land in S3 (SSE-S3, versioned), move to Glacier Flexible Retrieval after 1 day, and expire after 2,557 days (≈ 7 y). A one-time full export is the baseline. Not WORM, consistent with D-05.
- CloudWatch Logs retention: proposed 90 days (logs contain no record content). O-02.

## 9. Cost drivers
Detailed estimate with sources, split by prod and non-prod: **[cost-estimate.md](cost-estimate.md)**. At 20 users, year 1: prod ≈ $2.09, non-prod ≈ $2.03, combined ≈ $4.12 without free tier (≈ $0.40 / $0.06 / $0.46 with always-free). Year 7 combined ≈ $6.31 / $1.34.

Near zero at pilot volume: Lambda, API GW, DynamoDB on-demand, S3/CloudFront. Fixed: CloudWatch alarms (8 total, within 10 free), CI minutes. No KMS key fees (O-09). DynamoDB storage grows linearly over 7 years (small). Bedrock and WAF costs are gone for now.

## 10. Environments
Profiles per [ADR-0013](adr/0013-environment-profiles.md): `EnvProfile=lean` for dev/stage (synthetic data only, **admin full-table resets allowed** per BR-46 v1.2.2 / C-1; item-level audit update/delete still denied; AWS owned keys, no PITR/backup, 7-day logs, 1 alarm) and `EnvProfile=strict` for prod (AWS managed key, PITR, deletion protection, 7-year retention, 90-day logs, 5 alarms + export-errors alarm, monthly incremental export backup).

dev / stage / prod as stack sets in **one AWS account, us-east-1**. Stack names `SentinelQA-<env>-<Stack>`, parameters per env file (`iac/params/<env>.json`). GitHub Actions: lint → create change set → manual approval (stage/prod) → execute.

## 11. Assumptions
A-01 pilot-scale volume. A-02 SPA is a static bundle. A-03 only person names as PII. A-04 single workspace. A-06 free-text payloads ≤ 32 KB. A-07 English, US users. A-10 (new) the AI-dependent public pages (/demo, /try-your-document) are hidden or static in this build.

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
- **O-02** CloudWatch Logs retention (90 days proposed).
- **O-03** Single-account blast radius. Revisit before production customer data.
- **O-04** Values for D-07 (weights, bands, due-soon windows) and the controlled-data marker list (D-14).
- **O-05** Without WAF (D-11), public endpoints rely on API Gateway throttling. Set the throttle values.
- **O-06** Whether hidden AI modules show a "coming later" state or are removed from navigation (UX).
- **O-07** BRD OQs still open (aligned with BRD v1.2.2 §12): OQ-03, 06, 07, 08, 09, 10, 14, 15, 17, 18, 21, 22, 23. OQ-05 is deferred with AI. OQ-13 is **closed** (attestation logged on audit events, §4 step 4 / ADR-0005). OQ-01/02/04 are resolved (BR-47 / BR-45).

## 14. Pre-go-live checklist (prod)
Complete before the prod go-live. Items deferred by Vishwas on 2026-10-13.

- [ ] **O-10** — *Deferred to pre-go-live (2026-10-13)* Restore runbook: DynamoDB *import from S3* reads full exports. Replaying incremental exports onto a restored baseline needs a custom job. Decide whether to also take a periodic (e.g. annual) **full** export to shorten the restore chain (≈ $0.10/GB per full export).
- [ ] **O-11** — *Deferred to pre-go-live (2026-10-13)* S3 lifecycle does not transition objects smaller than 128 KB by default (behaviour **unverified** in this review). Small export files may stay in S3 Standard. The cost impact is cents, but confirm.
- [ ] **O-12** — *Deferred to pre-go-live (2026-10-13)* Export bucket deletion protection: versioning only (no Object Lock per D-05). Decide whether to add a bucket-policy deny on `s3:DeleteObject*` for all principals except a break-glass role.
- [ ] **Go-live step: one-time FULL export** of the prod `Domain` and `AuditLog` tables (`ExportType=FULL_EXPORT`, PITR on) to the `25-backup` export bucket. This is the baseline for the monthly incremental exports, ≈ $0.10/GB of table size, ≈ $0 at go-live. Record the export time as the initial watermark (`/sentinelqa/prod/backup/last-export-to`).

## 15. BRD v1.2 traceability (BR-44..BR-47)
| BR | Design element | Status |
|---|---|---|
| BR-44 gate on all free-text saves (400 / 422, marker id only logged, `controlledDataAttested` on audit event) | §4 data flow, [ADR-0005](adr/0005-controlled-data-gate-enforcement.md), `CONTROLLED_GATE_MODE: block`, SSM marker list | Consistent. Marker values pending (O-04) |
| BR-45 server-side persistence; prod ≥ 7 y; dev/stage synthetic only | §8, [ADR-0003](adr/0003-datastore.md), [ADR-0013](adr/0013-environment-profiles.md), 20-data Retain/no TTL, 25-backup | Consistent |
| BR-46 audit log append-only, IAM deny, corrections as new events, no WORM | §7 IAM, [ADR-0006](adr/0006-immutable-audit-log.md), 30-api deny statements (all profiles) | Consistent. C-1 **resolved** (BRD v1.2.2: covers app behaviour; prod strictly append-only; dev/stage full resets allowed) |
| BR-47 weights/bands and due-soon thresholds configurable (SSM) | §3 Config, 20-data SSM params (`supplier-risk/weights`, `due-soon-days` incl. training) | Consistent. Values pending (O-04) |

**C-1: Resolved (2026-10-13, BRD v1.2.2, commit 9836af2).** Vishwas approved: BR-46 covers application behaviour. Single-event updates/deletes are denied in every environment (IAM explicit deny). Prod is strictly append-only (deletion protection + Retain). In dev/stage only, admins may do full table resets (synthetic data, BR-45).

**C-2: Resolved (BRD v1.2.1 fix, commit 281c2c2).** OQ-13 now cites architecture-overview §4 / ADR-0005.

# Architect self-review: SentinelQA AWS architecture v0.4

| Field | Value |
|---|---|
| Date | 2026-10-13 |
| Reviewer | Architect (self-review) |
| Basis | BRD v1.2.2 (commit 9836af2), architecture overview v0.4, diagrams v0.4, ADR-0001..0013, cost-estimate v0.4, iac/ (7 CloudFormation templates + params) |
| Scope | Coverage of in-scope stories/BRs, cross-document consistency, stale decisions vs BRD resolved OQs, cfn-lint |

## Method
1. Confirmed BR-46 v1.2.2 text in `docs/requirements/BRD.md`: append-only is application behaviour; single-event updates/deletes are denied in every env; prod is strictly append-only; dev/stage admins may do full table resets (synthetic data, BR-45).
2. Grepped all architecture docs for leftover CDK/Bedrock/CMK/Object Lock/3-account/AgentTask/Guardrails references and checked each one's status.
3. Cross-checked alarm counts, encryption, retention, profiles and versions across overview, ADR-0013, cost-estimate, templates/params, iac/README and INDEX.
4. Traced stories and BRs to design elements (overview §15 plus the table below).
5. Ran `cfn-lint` 1.57.2 offline on all 7 templates: **0 errors, 0 warnings** (after the fixes below).

## Findings
| # | Sev | Location | Issue | Recommendation | Status |
|---|---|---|---|---|---|
| F-01 | major | iac/templates/30-api.yaml | Strict profile enabled X-Ray `Active` tracing on records-api, but the role had no X-Ray write permission. Traces would fail. | Attach `AWSXRayDaemonWriteAccess` only when `IsStrict` | **Fixed** |
| F-02 | major | iac/templates/50-observability.yaml | The API 5xx alarm used the placeholder `TODO-ApiId`, so the alarm would never fire | Export `ApiId` from 30-api and import it | **Fixed** |
| F-03 | major | overview (BR-31) | Seeding of sample/illustrative data (BR-31) dropped out of the design after v0.1. Nothing covers it, and it's unclear whether prod shows samples. | Add a seed step (script or deploy-time custom resource). Decide whether prod gets samples. | Open (Vishwas) |
| F-04 | minor | overview O-07 | The OQ list was stale: it listed OQ-13 (closed in v1.2.1) and left out OQ-09 (still open per BRD §12) | Align with the BRD still-open list | **Fixed** |
| F-05 | minor | overview Basis, C-1, C-2, §15 BR-46 row, lean profile text; ADR-0006; ADR-0013 | Still referenced BRD v1.2/v1.2.1 and showed C-1/C-2 as open | Basis set to v1.2.2. C-1 recorded as resolved. C-2 resolved (BRD now cites §4 / ADR-0005). | **Fixed** |
| F-06 | minor | ADR-0006 Decision | Original text still said "Object Lock archive in prod" with no superseded marker | Strike it through and add a banner pointing to the D-05 Resolution | **Fixed** |
| F-07 | minor | ADR-0009 Decision | Original "three accounts" text had no superseded marker | Strike it through and add a banner pointing to D-08 | **Fixed** |
| F-08 | minor | cost-estimate S-5 | Said "5 → 3" prod alarms, but there are now 6 (with export errors) | Change to 6 → 4 | **Fixed** |
| F-09 | minor | BRD BR-08 build rule | Still says "append-only in every environment" without the v1.2.2 nuance (dev/stage resets) | BusinessAnalyst to align BR-08 with BR-46 (requirement doc, not changed here) | Open (BA) |
| F-10 | minor | overview / US-41 (⌘K search) | No explicit search design (client-side over loaded lists vs a server query endpoint) | Client-side filter at pilot scale; add `GET /api/search` later if needed | Open |
| F-11 | minor | 30-api.yaml | Routes are a `{proxy+}` skeleton; per-route throttles depend on O-05 | Make routes explicit when the API contract is set | Open |
| F-12 | minor | iac (bootstrap) | GitHub OIDC deploy-role permissions and the CloudTrail/Budgets stack are still TODO | Define them before the first deploy | Open (pre-deploy) |
| F-13 | info | ADR-0001/0002/0003/0004/0005 options tables | Mention CDK/Bedrock/AgentTask/Guardrails as historical options | Fine. Each is marked Superseded/Deferred. | No action |
| F-14 | info | Pre-go-live checklist §14 | O-10/O-11/O-12 and the one-time full export are deferred | Keep them | No action |

Consistency confirmed: single account, us-east-1, CloudFormation only, AI deferred (`/api/ai/*` seam only), WAF deferred, no CMKs (AWS-managed in prod, AWS-owned in dev/stage), 7-year retention for prod only, PITR + monthly orchestration of daily incremental exports for prod, 6 prod alarms + 1 per lean env (8 total), 90-day/7-day log retention, `EnvProfile` lean/strict in params.

## Traceability summary
| BRD item | Design element |
|---|---|
| Record CRUD/stages, US-01..US-30 non-AI (CAPA, NCMR, SCAR, FAI, suppliers, POs, training, calibration) | records-api Lambda, DynamoDB single table (20-data), 30-api |
| US-03, BR-08, BR-46 audit | AuditLog table, conditional put, IAM explicit deny (30-api), prod deletion protection/Retain |
| BR-44 controlled-data gate | records-api attestation + keyword block on every free-text save (ADR-0005) |
| BR-45 synthetic non-prod / prod retention | ADR-0013 lean/strict, ADR-0003, 25-backup |
| BR-47 configurable weights/thresholds | SSM parameters read by records-api/reports-api |
| Dashboard, trends, counts (BR-42, §4.5) | reports-api (query-based) |
| BR-14/15 sort and filter | GSI1/GSI2 |
| BR-33 FAI separation of duties, BR-37 supersede | domain logic in records-api, transactional writes |
| Alerts | CloudWatch → SNS email (50-observability) |
| AI stories/BRs (deferred per BRD §12) | `/api/ai/*` seam, ADR-0004 Deferred |
| BR-31 sample data | **Gap (F-03)** |
| US-41 search | **Partial (F-10)** |

All other in-scope stories and BRs map to an element. No requirement was changed in this review.

## Items needing Vishwas
1. **F-03 / BR-31:** should prod show illustrative sample records, or should they appear only in dev/stage?
2. **F-10:** is client-side ⌘K search OK at pilot scale?
3. Still open from before: O-05 throttle values, BRD OQs listed in O-07, pre-go-live checklist items O-10..O-12.

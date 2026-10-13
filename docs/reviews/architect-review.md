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
| F-03 | major (**closed v0.5**: BR-31 v1.4 decision, seed design in overview §5.2) | overview (BR-31) | Seeding of sample/illustrative data (BR-31) dropped out of the design after v0.1. Nothing covers it, and it's unclear whether prod shows samples. | Add a seed step (script or deploy-time custom resource). Decide whether prod gets samples. | Open (Vishwas) |
| F-04 | minor | overview O-07 | The OQ list was stale: it listed OQ-13 (closed in v1.2.1) and left out OQ-09 (still open per BRD §12) | Align with the BRD still-open list | **Fixed** |
| F-05 | minor | overview Basis, C-1, C-2, §15 BR-46 row, lean profile text; ADR-0006; ADR-0013 | Still referenced BRD v1.2/v1.2.1 and showed C-1/C-2 as open | Basis set to v1.2.2. C-1 recorded as resolved. C-2 resolved (BRD now cites §4 / ADR-0005). | **Fixed** |
| F-06 | minor | ADR-0006 Decision | Original text still said "Object Lock archive in prod" with no superseded marker | Strike it through and add a banner pointing to the D-05 Resolution | **Fixed** |
| F-07 | minor | ADR-0009 Decision | Original "three accounts" text had no superseded marker | Strike it through and add a banner pointing to D-08 | **Fixed** |
| F-08 | minor | cost-estimate S-5 | Said "5 → 3" prod alarms, but there are now 6 (with export errors) | Change to 6 → 4 | **Fixed** |
| F-09 | minor (**closed**: BRD v1.2.3) | BRD BR-08 build rule | Still says "append-only in every environment" without the v1.2.2 nuance (dev/stage resets) | BusinessAnalyst to align BR-08 with BR-46 (requirement doc, not changed here) | Open (BA) |
| F-10 | minor (**closed v0.5**: client-side, BRD v1.4) | overview / US-41 (⌘K search) | No explicit search design (client-side over loaded lists vs a server query endpoint) | Client-side filter at pilot scale; add `GET /api/search` later if needed | Open |
| F-11 | minor (**fixed v0.5**: 67 explicit routes) | 30-api.yaml | Routes are a `{proxy+}` skeleton; per-route throttles depend on O-05 | Make routes explicit when the API contract is set | Open |
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

## Resolution of peer findings assigned to Architect (v0.5, 2026-10-13, BRD v1.4)
| Finding | Status | Where / note |
|---|---|---|
| DEV-1 API contract (blocker) | **Fixed** | `architecture/api/openapi.yaml` (OpenAPI 3.1, validated), 67 explicit routes in 30-api via `iac/tools/gen-routes.py` (commit aad1cd1) |
| DEV-2 timeline needs AuditLog read (blocker) | **Fixed** | records-api `GetItem/Query` on AuditLog + indexes; Update/Delete/BatchWrite deny kept (813987a) |
| DEV-3 build/artifact convention (blocker) | **Fixed** | ADR-0014; `<sha>/<fn>.zip` with AllowedPattern; bucket imported (96232f0, 813987a) |
| DEV-5 Domain DeleteItem vs remove/undo | **Fixed** | Deny kept in all envs; soft delete + audit event everywhere (overview §4, ADR-0006, spec DELETE ops) |
| DEV-6 GSI design | **Fixed** | Sparse GSI1 review queue, sparse GSI2 on `dueAt` with per-entity mapping (overview §5.1, 1c15d5c). Review-queue stage set TBD (DP-13/DP-02) |
| DEV-7 pagination/limits | **Fixed** | `limit` ≤ 100 + opaque cursor (spec conventions) |
| DEV-8 idempotency/concurrency | **Fixed** | `Idempotency-Key` on POST → ClientRequestToken + 24 h record; `version`/ETag/If-Match, 412/428; stage condition 409 |
| DEV-9 direct execute-api access | **Fixed** | ADR-0015, `X-Origin-Verify` from CloudFront, SSM SecureString, rotation (ceee66d) |
| DEV-13 gate contract (Architect part) | **Fixed** | 400/422 problem codes, `x-free-text` fields, whole-word case-insensitive matching, markers in 20-data. Rules still pending: DP-03 |
| DEV-16 personal/ephemeral envs, per-profile DeletionPolicy | **Open** | Needs `EnvName` AllowedPattern and `AWS::LanguageExtensions` DeletionPolicy, but InfraDeploy's boundary/role names and params assume dev/stage/prod. Proposed for the next round with InfraDeploy. Lean reset path covered by the runbook meanwhile |
| DEV-17 reports-api config | **Fixed** | 512 MB, `ENV_NAME`, PassThrough tracing; `GetParametersByPath` dropped from records-api (not needed, not in boundary) |
| DEV-18 log-group race, wildcard managed policy | **Fixed** | `DependsOn` log groups; inline `logs:CreateLogStream/PutLogEvents` on own group; X-Ray inline (strict) |
| DEV-19 deploy role self-modification | **Fixed by InfraDeploy** (3c6dbdf) | — |
| DEV-20 Form 3 key order / tx size | **Fixed** | `CH#<0000>` zero-padded, one row + audit per transaction (overview §5.1, spec) |
| DEV-23 search / Industry filter | **Closed** | Client-side ⌘K (US-41 v1.4); no `/api/search`. Industry filter not in the spec (single value, OQ-22) |
| DEV-24 metric/logging conventions | **Fixed** | EMF via Powertools: `SentinelQA`/`ControlledDataBlocked`/`Env`, `SentinelQA/Backup`/`ExportHealthy`/`Env`; never log bodies (overview §4) |
| DEV-25 doc inconsistencies | **Fixed** | §7 KMS line removed, `TransactWrite` IAM wording fixed, diagram CW arrow now EMF |
| Infra M-1 ApiId placeholder | **Fixed** (2c28676) | — |
| Infra M-2 UserErrors alarm | **Fixed** | Domain + AuditLog `SystemErrors` per-operation metric-math alarms (SystemErrors is published only on TableName+Operation, per AWS docs) (0075f52) |
| Infra M-3 gate metric contract | **Fixed** | Documented as a code contract (ADR-0005, overview §4) |
| Infra M-4 export failure / missed run | **Fixed** | Daily verify schedule + `ExportHealthy` alarm (missing = breaching, 3 × 1 day) + Lambda errors alarm |
| Infra M-5 stack policy / termination protection | **Fixed (documented)** | iac/README "Prod stack protection", overview §14 checklist |
| Infra M-6 deploy order | **Fixed** | 00 → 10 → 20 → 30 → 40 → 50, then 25 (prod) |
| Infra M-7 lean Retain + fixed names | **Resolved by InfraDeploy runbook** (84f4b74); per-profile DeletionPolicy tracked under DEV-16 | — |
| Infra m-7 backup blast radius | **Open (deferred)** | O-03 / O-12, pre-go-live checklist §14 |

**Permissions-boundary check** (`00-bootstrap.yaml` `AppRoleBoundary`, read-only review). The boundary covers every action the app roles use: DynamoDB Get/Put/Update/Query/ConditionCheck, export and Describe*, S3 export writes, Lambda invoke, SSM GetParameter(s)/PutParameter, logs, X-Ray, PutMetricData. **Gaps for InfraDeploy:** (1) the boundary has no `kms:Decrypt`. Whether decrypting the `aws/ssm` SecureString (ADR-0015) needs it under a boundary is **unverified**. Recommend adding `kms:Decrypt` with condition `kms:ViaService = ssm.us-east-1.amazonaws.com` to the boundary and to the deploy role. (2) The deploy role needs `ssm:GetParameter` on `/sentinelqa/<env>/edge/origin-verify`. (3) Params: remove `ArtifactBucket` from `30-api` and `25-backup`, and add the pipeline-supplied `OriginVerifySecret` for `40-web` (iac/README).

## Items needing Vishwas
- (v0.5) BR-31, US-41, BR-47 and the BR-44 matching rule were decided 2026-10-13. Still open: DP-01..DP-19 except those resolved in v1.4 (DP-15 resolved; DP-03 and DP-16 partially). Also whether KPIs count `isSample` items (OQ-10).
1. **F-03 / BR-31:** should prod show illustrative sample records, or should they appear only in dev/stage?
2. **F-10:** is client-side ⌘K search OK at pilot scale?
3. Still open from before: O-05 throttle values, BRD OQs listed in O-07, pre-go-live checklist items O-10..O-12.

## Resolution: Developer review #26–#29 (2026-10-13)
| Finding | Status | Resolution |
|---|---|---|
| DEV-26 Lambda roles can't decrypt origin-verify | **Fixed** | `30-api.yaml`: both roles get `kms:Decrypt` on `key/*` with ViaService ssm, EncryptionContext PARAMETER_ARN = `/sentinelqa/<env>/edge/origin-verify`, ResourceAliases `alias/aws/ssm` (mirrors boundary). GetParameter already covered by `/sentinelqa/<env>/*`. Comment fixed, ADR-0015 updated. Alias condition unverified, dev smoke test required |
| DEV-27 CFR ranges stored as literals | **Fixed (rule pending DP-03)** | `20-data.yaml`: keywords only in `controlled-data/markers`; new `controlled-data/cfr-ranges` structured ranges; citation regex + range check in code (overview §4, ADR-0005). Reference test `iac/tools/test_marker_patterns.py` |
| DEV-28 boundary PutParameter too broad | **Fixed by InfraDeploy** (ba4fa73) | — |
| DEV-29 no overdue index for CAPA/NCMR | **Fixed (index); rule open** | GSI2 `dueAt` = quality record `dueDate` (BRD §6 "days left (due)"); new sparse GSI3 `needByAt` for BR-15. Open: BRD defines no CAPA/NCMR overdue rule (OQ-25 / DP-20, BRD v1.4.2) |

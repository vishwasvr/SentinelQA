# CI workflow design, backup version expiry, and real-data guard (QA-32, QA-33, QA-34)

Owner: InfraDeploy. Status: **design only**. No `.github/workflows` file exists yet, and none is created until building opens. Extends ADR-0012 (pipeline) with a test stage.

## 1. QA-32 — CI workflow design

### 1.1 Workflows (to be created later as `.github/workflows/*.yml`)

| Workflow | Trigger | AWS access | Purpose |
|---|---|---|---|
| `ci.yml` | `pull_request` to `main`, `push` to `main` | **None** (no OIDC, `permissions: contents: read`) | Lint and test. Required status check for merge. |
| `deploy.yml` | `workflow_run` of `ci.yml` succeeded on `main`; manual `workflow_dispatch` | OIDC via `AWS_DEPLOY_ROLE_ARN` of the GitHub environment (`id-token: write`) | Package, change set, approval, execute (ADR-0012). |

`deploy.yml` never runs on a pull request, so code from a fork or a branch can't assume the deploy role. The OIDC trust (00-bootstrap) already limits `sub` to `repo:vishwasvr/SentinelQA:environment:<env>`.

### 1.2 `ci.yml` stages (all must pass; fail fast in this order)

1. **Secrets scan:** gitleaks on the diff. A finding fails the run ("never commit secrets").
2. **IaC lint:** `cfn-lint` (pinned 1.57.2) on `docs/architecture/iac/templates/*.yaml`, plus a JSON schema check of `params/*.json` (Throttle 10/20, account 723940054516, us-east-1, `CreateOidcProvider` = `"true"`).
3. **Static checks:** type-check and lint for the app code (Developer picks the tools at build time).
4. **Unit tests:** includes the §4.2 config-failure cases (QA-31), the DP-03 marker cases (`test_marker_patterns.py` plus `I.T.A.R`, `C-U-I`, `15 C.F.R. 734`), the DP-11 revision ordering, the DP-16 ±0.001 sum, and the §4.3 size caps (349 KB pass, 351 KB → 413).
5. **Contract tests:** validate `openapi.yaml` and check handlers against it (request and response schemas, the 413/422/429/503 codes).
6. **Gate coverage:** the CUI/ITAR gate tests must cover every free-text write route listed in `openapi.yaml`. A route with no gate test fails the run.
7. **Real-data guard check (QA-34 §3.2):** the seed-fixture lint.
8. **Integration tests (DynamoDB Local, no AWS):** QA-28 single audit write path, including that an overwrite attempt fails, and that nothing is written after a 413.

Coverage threshold (DECIDED by Vishwas, 2026-10-13): at least 90% line and branch coverage overall; 100% for the gate matcher, `buildAuditPut`, the `isSample` checks and the config loader; and a PR fails if coverage drops by more than 1 point. It counts app code only, not generated OpenAPI types, IaC, tests or fixtures. The required `unit-coverage` job must pass before any dev deploy ([delivery-strategy.md](../delivery-strategy.md) §3b).

### 1.3 `deploy.yml` stages (ADR-0012 plus tests)

1. Re-run stages 1–2 of `ci.yml` on the exact commit (defence in depth).
2. Package Lambda artifacts as `<sha>/...zip` and upload them to the artifact bucket.
3. Create a change set per stack in the stack order (`first-deploy.md` §3), passing `--role-arn` cfn-exec. Fail if a change set replaces or deletes a `Retain` resource.
4. **dev:** execute automatically, then run the post-deploy smoke test (#26: SSM decrypt of the origin secret, `/health` through CloudFront, 403 without the origin header, 429 above 10 req/s).
5. **stage / prod:** a GitHub environment approval is required. The prod reviewer is Vishwas. Then execute, run the smoke test, and for prod run `first-deploy.md` §6 (the backup check).
6. Concurrency: one deploy per environment (`concurrency: deploy-<env>`, no cancel-in-progress).

### 1.4 Rules

- Actions are pinned by commit SHA. `permissions` are set per job, and the default is `contents: read`.
- No long-term AWS keys in secrets. OIDC only.
- The first live workflow files are created only after building opens and are pushed only with Vishwas's approval.

## 2. QA-33 — Backup version expiry (feeds O-12)

Current: `25-backup.yaml` sets `NoncurrentVersionExpiration: NoncurrentDays: 30`.

Normal exports are write-once (each window has a unique prefix), so a noncurrent version only appears if an export object is overwritten or deleted. That's exactly the tampering case ADR-0006 relies on the export to detect. With 30 days, the original is gone after a month.

**Decided (Vishwas, 2026-10-13, relayed by Chief of Staff):** `NoncurrentDays` = `RetentionDays` (2557), plus the O-12 delete-deny bucket policy. Both are now in `25-backup.yaml`:

- `NoncurrentVersionExpiration: NoncurrentDays: !Ref RetentionDays`.
- Bucket policy `DenyDeleteExceptBreakGlass` denies `s3:DeleteObject`, `s3:DeleteObjectVersion`, `s3:PutBucketVersioning` (so versioning can't be suspended) and `s3:DeleteBucket` to every principal except the role named by `BreakGlassRoleName` (default `SentinelQA-prod-breakglass`). That role isn't created by any stack. An admin creates it only when it's needed, with Vishwas's approval.
- S3 lifecycle expiry still works, because bucket policies don't apply to lifecycle actions.
- Not denied: `s3:PutLifecycleConfiguration` and `s3:PutBucketPolicy`, because CloudFormation (cfn-exec) needs both to update this stack. Residual risk: an account admin could edit the policy and then delete. Detection for that depends on CloudTrail (M-8). This replaces my earlier recommendation to also deny `PutLifecycleConfiguration`.

## 3. QA-34 — Guard against real data in dev/stage (BR-45)

### 3.1 Technical guards

1. **Seed-only loader:** dev and stage get data only through `scripts/seed` from fixtures in the repo. Every fixture record must carry `isSample: true`. The loader refuses any record without it. Per BR-49 (decided by Vishwas, 2026-10-13), the seed command is also the only way sample data reaches prod; in prod it needs the same approval as any other prod write.
   - **Controlled-data gate on seed (QA-44):** before writing anything, `scripts/seed` runs every free-text field of every fixture record through the same BR-44 gate function the API uses (shared module, same SSM marker and CFR-range lists for the target env). Any marker hit aborts the whole run with a non-zero exit before the first write. It logs only the fixture file, record id and marker id, never the matched text. The seed never bypasses the gate, in any env.
   - **Prod seed run log (QA-44):** every prod seed run writes a run record to CloudWatch Logs group `/sentinelqa/prod/seed-runs`. The record holds the operator identity from `sts get-caller-identity`, the git commit, the fixture file list with record counts, the approval reference, start and end times, and the outcome. It never holds record bodies or credentials. It is a CloudWatch Logs log group (not SSM), created by IaC in the prod stack with 7-year retention to match the audit data (`templates/20-data.yaml` `SeedRunsLogGroup`, prod only). The write permission is the prod-only managed policy `SentinelQA-prod-seed-runs-write` (`SeedRunsWritePolicy`), attached to the prod seed operator's Identity Center permission set during the account split. Only the prod seed operator's `aws login` role is allowed `logs:CreateLogStream` and `logs:PutLogEvents`, and only on that log group's ARN. A prod seed run without an approval reference is refused.
2. **Write-path check (non-prod):** in `dev` and `stage`, the API rejects creates without `isSample=true` with a 422 `non_sample_data_forbidden`. The env profile turns this on (ADR-0013).
   **Prod (BR-49, decided):** the API rejects any create with `isSample=true` with a 422 `sample_flag_forbidden_in_prod`; nothing is saved and no audit event is written. The UI offers no sample option (openapi.yaml `30a1d00`).
3. **CI fixture lint (ci.yml stage 7):** fails if a fixture has no `isSample: true`, or if it contains values that look real (email domains other than `example.com`/`example.org`, phone numbers outside the 555-01xx range, or CFR/ITAR markers outside the DP-03 test fixtures).
4. **No prod-to-nonprod copy path:** the deploy role and cfn-exec have no permission to restore or import prod exports into dev or stage tables. A restore drill uses a short-lived env (`first-deploy.md` §6 step 10) with its own approval.

### 3.2 Procedural guard

The `nonprod-table-reset.md` and `first-deploy.md` checklists add: "Confirm that only repo fixtures were loaded (`isSample=true` on 100% of items)," checked with a read-only scan count before sign-off.

### 3.3 Status (closed)

Guard 2's 422 `non_sample_data_forbidden` is in `openapi.yaml` (`31aef26`). The prod 422 `sample_flag_forbidden_in_prod` (BR-49, `30a1d00`) and the 422 `sample_flag_immutable` on PATCH (`28e42a1`) are also there. Nothing is open (QA-34, QA-37).

**Gate (QA-32):** `ci.yml` and `deploy.yml` must exist and pass on a PR before the first application-code merge to `main`. They are built to §1 and §2 when building opens.

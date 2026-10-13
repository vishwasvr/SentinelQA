# CI workflow design, backup version expiry, and real-data guard (QA-32, QA-33, QA-34)

Owner: InfraDeploy. Status: **design only**. No `.github/workflows` file exists yet, and none is created until building opens. Extends ADR-0012 (pipeline) with a test stage.

## 1. QA-32 — CI workflow design

### 1.1 Workflows (to be created later as `.github/workflows/*.yml`)

| Workflow | Trigger | AWS access | Purpose |
|---|---|---|---|
| `ci.yml` | `pull_request` to `main`, `push` to `main` | **None** (no OIDC, `permissions: contents: read`) | Lint and test. Required status check for merge. |
| `deploy.yml` | `workflow_run` of `ci.yml` succeeded on `main`; manual `workflow_dispatch` | OIDC via `AWS_ROLE_ARN` of the GitHub environment (`id-token: write`) | Package, change set, approval, execute (ADR-0012). |

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

Coverage threshold: decided by Developer at build time and recorded here. Until then, there's no numeric gate.

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

**Recommendation:** set `NoncurrentDays` equal to `RetentionDays` (2557, 7 years). Noncurrent versions only exist after an overwrite or delete, so the cost is close to zero. Pair it with the O-12 bucket-policy deny on `s3:DeleteObject*` and `s3:PutLifecycleConfiguration` for every principal except a break-glass role.

Alternatives: (a) keep 30 days (cheapest, weakens tamper evidence); (b) 365 days (a middle ground). Needs Vishwas's decision with O-12. The template is unchanged until then.

## 3. QA-34 — Guard against real data in dev/stage (BR-45)

### 3.1 Technical guards

1. **Seed-only loader:** dev and stage get data only through `scripts/seed` from fixtures in the repo. Every fixture record must carry `isSample: true`. The loader refuses any record without it and refuses to run when `EnvName` = `prod`.
2. **Write-path check (non-prod):** in `dev` and `stage`, the API rejects creates without `isSample=true` with a 422 `non_sample_data_forbidden`. The env profile turns this on (ADR-0013). Prod ignores it.
3. **CI fixture lint (ci.yml stage 7):** fails if a fixture has no `isSample: true`, or if it contains values that look real (email domains other than `example.com`/`example.org`, phone numbers outside the 555-01xx range, or CFR/ITAR markers outside the DP-03 test fixtures).
4. **No prod-to-nonprod copy path:** the deploy role and cfn-exec have no permission to restore or import prod exports into dev or stage tables. A restore drill uses a short-lived env (`first-deploy.md` §6 step 10) with its own approval.

### 3.2 Procedural guard

The `nonprod-table-reset.md` and `first-deploy.md` checklists add: "Confirm that only repo fixtures were loaded (`isSample=true` on 100% of items)," checked with a read-only scan count before sign-off.

### 3.3 Open item

Guard 2 adds a rule to the API (a new 422 code in non-prod). Architect should add it to `openapi.yaml` when building opens. That's a spec change only, and nothing changes now.

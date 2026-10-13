# Delivery strategy: test environment, branching, CI/CD promotion and versioning (PROPOSAL for Vishwas)
Owners: InfraDeploy + Architect (joint); Tester: test stages.
Status: PROPOSED, 2026-10-13. Architect drafted this; InfraDeploy adds infra details; Tester adds test stages (§3a). Docs only: nothing is created and nothing is pushed.

Today, there is one branch (`main`) with direct pushes. `.github/workflows/` does not exist in the repo yet, so `ci.yml` and `deploy.yml` are designed in ADR-0012 and ADR-0014 but not written. In AWS, only `SentinelQA-dev-Bootstrap` and `SentinelQA-Account-OIDC` exist (account 723940054516). Stage and prod have not been bootstrapped.

Infra note: `.github/workflows/` does not exist yet. `ci.yml` and `deploy.yml` are designed in [ADR-0012](adr/0012-ci-cd-github-actions-oidc.md), [ADR-0014](adr/0014-build-packaging.md) and [ci-and-data-guards.md](iac/ci-and-data-guards.md) §1, and are created only when building opens. Everything below marked (B) is a **PROPOSAL pending Vishwas's decision**.

## 1. Environments
| Option | What it is | Cost/month (cost-estimate §3b) |
|---|---|---|
| A | dev only now, stage later | dev share of non-prod |
| **B (recommended)** | Bootstrap stage now in the shared non-prod account and use it as the test environment (Tester runs acceptance and smoke tests there before anything goes to prod). Prod goes in its own account before go-live (O-03). | dev + stage together ≈ $0.06 with always-free, ≈ $2.63 without free tier; most of that is GitHub Actions minutes |
| C | Merge dev and stage into one env (S-10) | saves ≈ $0.10; loses the rehearsal before prod; not recommended |

Roles: **dev** is for fast feedback and is deployed automatically on every merge to main. **stage** is a production-like rehearsal on the same templates with synthetic sample data only (overview §4.4 and §4.6). **prod** is strict, controlled data.
Decision needed: approve bootstrapping stage (a new AWS create that InfraDeploy runs only after Vishwas says yes).

**Stage data rule (BR-49 / US-43, BR-45):** stage accepts sample data only. The API rejects any create without `isSample=true` with 422 `non_sample_data_forbidden` (nothing saved, no audit event; [ci-and-data-guards.md](iac/ci-and-data-guards.md) §3.1 guard 2). Stage test data comes from `scripts/seed` (repo fixtures, `isSample: true`, gated by the controlled-data check) or from the UI, and **never** from copies of prod data: there is no prod-to-nonprod restore/import path (guard 4), and after the O-03 split no cross-account trust exists ([prod-account-split.md](../runbooks/prod-account-split.md) §6).

### 1a. Stage bootstrap steps (InfraDeploy; PLAN ONLY, needs Vishwas's explicit approval before anything is created)
Same templates and stack order as dev ([first-deploy.md](../runbooks/first-deploy.md) §3), in the shared account 723940054516, us-east-1, with `iac/params/stage.json` (`EnvName=stage`, `EnvProfile=lean`, `GitHubEnvironment=stage`).
0. `SentinelQA-Account-OIDC`: already exists in this account (shared with dev). Nothing to do.
1. [CREATE, Vishwas's admin session] `SentinelQA-stage-Bootstrap` (00-bootstrap, `EnvName=stage`). Outputs the stage deploy role (trust `repo:vishwasvr/SentinelQA:environment:stage`), `SentinelQA-stage-cfn-exec`, the boundary and `sentinelqa-stage-artifacts-<account>`.
2. [CREATE] SSM SecureString `/sentinelqa/stage/edge/origin-verify`, a new value, not dev's ([ADR-0015](adr/0015-origin-verify-header.md), first-deploy §2a).
3. [WRITE, repo settings] GitHub `stage` environment and its variables (§2a).
4. Pipeline (stage deploy role, `--role-arn` cfn-exec), in order: 10 `SentinelQA-stage-Security` → 20 `-Data` (`EnvProfile=lean`) → 30 `-Api` (after zips upload, `EnvProfile=lean`) → 40 `-Web` → 50 `-Observability` (`EnvProfile=lean`). No 25-backup (prod only).
5. Confirm the SNS email subscription for stage (first-deploy §4).
6. Smoke test (same as dev, ci-and-data-guards §1.3 step 4): `/health` through CloudFront 200, 403 without the origin header, 429 above 10 req/s, SSM decrypt of the origin secret, a create without `isSample` returns 422 `non_sample_data_forbidden`, and the QA-36 audit Deny check (first-deploy §5b).
7. Load sample data with `scripts/seed` only, then the read-only `isSample=true` 100% count check (ci-and-data-guards §3.2).

### 1b. Cost of stage (repo figures only)
- Source: [cost-estimate.md](cost-estimate.md) §3b prices **dev + stage combined**, year 1, 20 users: **≈ $2.63/month without free tier, ≈ $0.06/month with always-free**; ≈ $1.68 of the $2.63 is GitHub Actions minutes (≈ 280 min), normally covered by the GitHub plan (§0). Year 7, 20 users: ≈ $2.85 / ≈ $0.06 (§0).
- **Stage on its own is unpriced**: the repo has no dev/stage split. The only stage-specific delta quoted is S-10 (§7): merging dev and stage would save ≈ $0.10/month (one alarm), so stage's alarm is ≈ $0.10 without free tier.
- **Per account after O-03 (§9a, NOT re-priced):** the account, Organizations and Identity Center have no fee; always-free allowances become per account, so the split "should lower or keep the total, not raise it"; the prod account adds a second CloudTrail trail's S3 storage and a budget alarm, both **unpriced** (Budgets unverified; prod-account-split §7 says the first two budgets are free). The §0–§3 figures are account-wide and out of date for prod until OI-7 re-pricing.
- One-time stage bootstrap cost: **unpriced** in the repo (cost-estimate §0 gives one-time setup ≈ $0 AWS for the whole design).

## 2. Branching and PRs
| Option | Flow |
|---|---|
| A | Keep direct pushes to main (today). Not recommended once code exists: there's no review, and CI runs only after the fact. |
| **B (recommended)** | Short-lived feature branches (`feat/…`, `fix/…`, `docs/…`), then a PR to `main`. Branch protection on `main`: PR required, required checks green (§3), 1 approval (Vishwas, or code owners by folder), no force-push, no deletion, linear history (squash merge). |
| C | GitFlow (develop, release and hotfix branches). Too heavy for a small team. |

Agents open PRs; Vishwas (or a designated reviewer) approves the merge. Branch protection is a GitHub setting, so Vishwas makes the change himself or approves it.

### 2a. GitHub settings (PROPOSAL; Vishwas applies or approves, [WRITE, repo settings])
**Environments** (ADR-0012, first-deploy §5, prod-account-split §4):

| Env | Account | Variables (not secrets) | Required reviewer | Deployment branches/tags |
|---|---|---|---|---|
| dev | shared 723940054516 | `AWS_ACCOUNT_ID`, `AWS_DEPLOY_ROLE_ARN` (dev 00 output), `AWS_REGION=us-east-1` | none | `main` |
| stage | shared 723940054516 | same three, stage values | **proposed: Tester** (fallback Vishwas) | `main` and tags `v*` |
| prod | new prod account (O-03) | same three, prod account values | **Vishwas**, no self-review bypass | tags `v*` (and `main`) only |

No AWS secrets anywhere; OIDC only. Note: first-deploy §5 names the role variable `AWS_ROLE_ARN`; prod-account-split §4 uses `AWS_DEPLOY_ROLE_ARN`. Proposal: standardise on `AWS_DEPLOY_ROLE_ARN` and update first-deploy §5 when the workflows are written. Check that no dev/stage variable carries the prod account ID.

**Branch protection on `main`:** PR required (1 approval), required status checks = the `ci.yml` jobs below, branch up to date before merge, squash merge / linear history, no force pushes, no deletion, **include administrators**.

**Required status checks (job names proposed; from ci-and-data-guards §1.2 plus Developer additions):**
`secrets-scan` (gitleaks) · `cfn-lint` (all templates, pinned 1.57.2, plus params schema) · `static` (typecheck/lint, incl. the **audit lint rule**: fails any code touching `AUDIT_TABLE` outside `buildAuditPut`) · `unit` (audit overwrite, item size caps, config failures, the `isSample` 422s `non_sample_data_forbidden` / `sample_flag_forbidden_in_prod` / `sample_flag_immutable`, the seed controlled-data gate, plus the §1.2 cases) · `contract` (openapi validation and handler checks incl. the QA-41/QA-42 error codes) · `gate-coverage` · `seed-fixture-lint` (QA-34 guard 3) · `integration-local` (DynamoDB Local).

## 3. Continuous testing and promotion
- **ci.yml (every PR and every push to main):** cfn-lint on all templates; openapi regenerated from `gen_openapi.py`, with a diff check that fails if it is stale; unit tests; contract tests against openapi; secret scan; controlled-data guard checks (ci-and-data-guards.md). These are the required checks for §2.
- **deploy.yml:** build once, then change set, then execute (ADR-0012), using one artifact for all envs:
  1. Merge to main: deploys **dev** automatically, then runs smoke tests.
  2. **stage:** the same artifact, gated by GitHub environment approval, then acceptance and regression tests (Tester).
  3. **prod:** the same artifact from a release tag, gated by required reviewer Vishwas plus a green stage run, then post-deploy smoke tests. Rollback is on failure (§4).

| Option | Promotion trigger |
|---|---|
| A | Everything manual (workflow_dispatch). |
| **B (recommended)** | dev is automatic on merge; stage and prod are manual approval gates on the same artifact. |
| C | Fully automatic to stage. Possible later, once tests are trusted. |

**Infra gates in the flow:**
- **QA-32:** `ci.yml` and `deploy.yml` must exist and pass on a PR before the first application-code merge to `main` (ci-and-data-guards §3.3).
- **After the dev deploy:** smoke test (#26) plus the **QA-36 transaction-only audit Deny check** (first-deploy §5b). Both must pass before stage can be promoted.
- **Before prod approval:** first-deploy §5a PLACEHOLDER gate; after first 25-backup deploy, §6 backup check (QA-29). Prod requires the O-03 account split first.
- One deploy per env at a time (`concurrency: deploy-<env>`); change sets fail if they replace or delete a `Retain` resource.

### 3a. Test stages (Tester to fill in)
_TBD by Tester._

## 4. Versioning (app and IaC together)
| Option | Scheme |
|---|---|
| A | Commit SHA only. |
| **B (recommended)** | One monorepo version: SemVer tags `vX.Y.Z` on main create a GitHub Release with notes. Artifacts (Lambda zips, SPA bundle, packaged templates) go to the artifacts bucket under `<version>/<sha>/` and are immutable. Each env records the deployed version in an SSM parameter `/sentinelqa/<env>/version`. App and IaC always ship together from the same tag. |
| C | Separate version numbers for app and IaC. Adds drift risk; not recommended. |

**Rollback:** redeploy the previous tag's stored artifact through the same pipeline. CloudFormation rolls back automatically if a change set fails. DynamoDB data is never rolled back by deploys: schema changes stay additive, and prod has backups (O-01). A hotfix is a `fix/…` branch, then a PR, then a patch tag.

**Infra details (versioning and rollback):**
- Artifacts are built once per commit: `s3://sentinelqa-<env>-artifacts-<account>/<commit-sha>/<function>.zip` (ADR-0014), passed as `RecordsApiKey`/`ReportsApiKey`/`ExportFnKey`, never overwritten. The SPA build is stored the same way under the SHA. Promotion copies the same SHA's objects into the next env's artifact bucket (and, for prod, across accounts by the pipeline); nothing is rebuilt.
- A tag `vX.Y.Z` points at one main commit, so tag → SHA → artifacts and templates are one set.
- **Rollback = redeploy the previous tag** through deploy.yml (same approvals). New SHA key → CloudFormation updates code. Rollback restores code and infra only.
- **Data is not rolled back.** DynamoDB is untouched by deploys; schema changes stay additive and backward compatible for one release. Prod data recovery is PITR or the 25-backup S3 exports (O-01; restore runbook O-10, pre-go-live). Dev/stage have no backup (lean) and are reset and reseeded instead ([nonprod-table-reset.md](../runbooks/nonprod-table-reset.md)).

## Decisions for Vishwas
1. Bootstrap stage now as the test environment (B, steps §1a, cost §1b)? PROPOSAL.
2. Feature branches, PRs and branch protection on main with the §2a required checks (B)? Stage reviewer: Tester? PROPOSAL.
3. dev automatic, stage and prod approval-gated on one artifact, QA-36 check before stage (B)? PROPOSAL.
4. Single SemVer tags with immutable SHA artifacts and rollback by redeploying the previous tag (B)? PROPOSAL.

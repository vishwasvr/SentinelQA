# Proposal: test environment, branching, CI/CD promotion and versioning (DRAFT for Vishwas)
Status: PROPOSED, 2026-10-13. Architect drafted this; InfraDeploy adds infra details; Tester adds test stages (§3a). Docs only: nothing is created and nothing is pushed.

Today, there is one branch (`main`) with direct pushes. `.github/workflows/` does not exist in the repo yet, so `ci.yml` and `deploy.yml` are designed in ADR-0012 and ADR-0014 but not written. In AWS, only `SentinelQA-dev-Bootstrap` and `SentinelQA-Account-OIDC` exist (account 723940054516). Stage and prod have not been bootstrapped.

## 1. Environments
| Option | What it is | Cost/month (cost-estimate §3b) |
|---|---|---|
| A | dev only now, stage later | dev share of non-prod |
| **B (recommended)** | Bootstrap stage now in the shared non-prod account and use it as the test environment (Tester runs acceptance and smoke tests there before anything goes to prod). Prod goes in its own account before go-live (O-03). | dev + stage together ≈ $0.06 with always-free, ≈ $2.63 without free tier; most of that is GitHub Actions minutes |
| C | Merge dev and stage into one env (S-10) | saves ≈ $0.10; loses the rehearsal before prod; not recommended |

Roles: **dev** is for fast feedback and is deployed automatically on every merge to main. **stage** is a production-like rehearsal on the same templates with synthetic sample data only (overview §4.4 and §4.6). **prod** is strict, controlled data.
Decision needed: approve bootstrapping stage (a new AWS create that InfraDeploy runs only after Vishwas says yes).

## 2. Branching and PRs
| Option | Flow |
|---|---|
| A | Keep direct pushes to main (today). Not recommended once code exists: there's no review, and CI runs only after the fact. |
| **B (recommended)** | Short-lived feature branches (`feat/…`, `fix/…`, `docs/…`), then a PR to `main`. Branch protection on `main`: PR required, required checks green (§3), 1 approval (Vishwas, or code owners by folder), no force-push, no deletion, linear history (squash merge). |
| C | GitFlow (develop, release and hotfix branches). Too heavy for a small team. |

Agents open PRs; Vishwas (or a designated reviewer) approves the merge. Branch protection is a GitHub setting, so Vishwas makes the change himself or approves it.

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

### 3a. Test stages (Tester to fill in)
_TBD by Tester._

## 4. Versioning (app and IaC together)
| Option | Scheme |
|---|---|
| A | Commit SHA only. |
| **B (recommended)** | One monorepo version: SemVer tags `vX.Y.Z` on main create a GitHub Release with notes. Artifacts (Lambda zips, SPA bundle, packaged templates) go to the artifacts bucket under `<version>/<sha>/` and are immutable. Each env records the deployed version in an SSM parameter `/sentinelqa/<env>/version`. App and IaC always ship together from the same tag. |
| C | Separate version numbers for app and IaC. Adds drift risk; not recommended. |

**Rollback:** redeploy the previous tag's stored artifact through the same pipeline. CloudFormation rolls back automatically if a change set fails. DynamoDB data is never rolled back by deploys: schema changes stay additive, and prod has backups (O-01). A hotfix is a `fix/…` branch, then a PR, then a patch tag.

## Decisions for Vishwas
1. Bootstrap stage now as the test environment (B)?
2. Feature branches, PRs and branch protection on main (B)?
3. dev automatic, stage and prod approval-gated on one artifact (B)?
4. Single SemVer tags with immutable artifacts and rollback by redeploying the previous tag (B)?

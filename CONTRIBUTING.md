# Contributing

## Branches and pull requests
- `main` is protected. Never push to it directly.
- Work on a feature branch (`feat/…`, `fix/…`, `docs/…`, `ci/…`, `chore/…`) and open a pull request into `main`.
- Keep PRs focused; one logical change per commit where practical.
- **Merges need the owner's (Vishwas's) approval.** Authors do not merge their own PRs. The only standing exception is a sign-off-only PR limited to `releases/**` (see below).

## Required CI checks (`.github/workflows/ci.yml`)
All must pass before merge: `audit-lint` (typecheck, ESLint, audit write-path rule), `unit`, `unit-coverage`, `openapi-contract`, `cfn-lint`, `seed-fixture-lint`, `releases-path-check`, `secrets-scan`, `params-schema`.

Run locally before pushing:
```
npm ci
npm run typecheck && npm run lint && npm run audit-lint
npm run coverage && npm run coverage:gate
npm run seed-fixture-lint && npm run params-schema
```

## Coverage gate
Policy in `ci/coverage-policy.json`, enforced by `scripts/ci/coverage-gate.mjs`:
- **90%** lines and branches overall.
- **100%** lines and branches for the safety-critical modules `src/shared/gate/`, `src/shared/audit/`, `src/shared/sample/`, `src/shared/config/`.
- Fail if overall coverage drops **more than 1 point** below the baseline on `main` (`ci/coverage-baseline.json`; CI reads the copy on `origin/main`, so a PR cannot lower its own baseline). Update the baseline in the PR that changes coverage.

## Release sign-off (`releases/<sha>/dev-signoff.md`)
See [delivery-strategy.md](docs/architecture/delivery-strategy.md).
1. After the dev deploy, commit `releases/<sha>/dev-signoff.md`, where `<sha>` is the commit whose artifact is promoted. Record the SHA, that QA-36 and the dev smoke test passed, and what was checked.
2. The sign-off PR must change nothing outside `releases/**` (`releases-path-check`).
3. Merging a sign-off does not trigger a build (`paths-ignore`). Stage deploys only when the sign-off exists and its SHA matches the artifact; prod stays gated on the owner.

## Secrets and personal data
- Never commit secrets, credentials, tokens, keys, or **any email address** (this repo is public). `secrets-scan` (gitleaks) checks history and the PR diff; `params-schema` rejects emails in params.
- Values such as alarm recipients come from GitHub environment variables or SSM, not the repo.
- See [SECURITY.md](SECURITY.md).

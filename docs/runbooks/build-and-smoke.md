# Build and smoke scripts

Used by `.github/workflows/deploy.yml` (ADR-0014, delivery-strategy §3/§4).

## `npm run build:lambdas`
`scripts/build-lambdas.mjs` bundles `src/functions/<name>/index.ts` for `records-api` and `reports-api` with esbuild
(`--platform=node --target=node20 --format=cjs --minify`, AWS SDK bundled) and writes `dist/records-api.zip` and
`dist/reports-api.zip`, each with `index.js` at the zip root (`Handler: index.handler` in `30-api.yaml`).
Zips are deterministic (sorted entries, fixed mtime 1980-01-01 12:00, fixed compression), so the same commit gives the
same `sha256` in `dist/manifest.json`. No system `zip` needed (uses `fflate`). `dist/` is gitignored; deploy.yml writes
`manifest.json` itself.

The handlers are currently **stubs**: every request returns a 404 `application/problem+json` (`code: not_found`).

## `npm run smoke:deployed`
`scripts/smoke-deployed.mjs` checks a deployed environment and exits non-zero on any failure:
- `GET /api/config` returns 200 JSON, or a problem+json envelope (non-5xx; the stub returns 404 `not_found`).
- `GET /api/__smoke_unknown_route__` returns 404 (API Gateway has no catch-all route).

| Env var | Required | Meaning |
|---|---|---|
| `SMOKE_BASE_URL` | yes | Base URL, e.g. `https://<distribution>.cloudfront.net` (the `SentinelQA-<env>-DistributionDomain` output) |
| `SMOKE_ORIGIN_VERIFY` | no | `X-Origin-Verify` value (ADR-0015), only when calling the API directly. From env/secrets only, never in code |
| `DEPLOY_ENV` | no | Label for logs (set by deploy.yml) |
| `SMOKE_TIMEOUT_MS` | no | Per-request timeout, default 10000 |

Note: deploy.yml currently runs `DEPLOY_ENV=dev npm run smoke:deployed` without `SMOKE_BASE_URL`, so the step fails
until the workflow supplies it (for example from the 40-web `DistributionDomain` stack output).
The remaining smoke items (403 without origin header, 429 throttle, QA-36) stay manual (first-deploy §5b).

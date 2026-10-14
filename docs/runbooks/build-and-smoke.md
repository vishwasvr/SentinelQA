# Build and smoke scripts

Used by `.github/workflows/deploy.yml` (ADR-0014, delivery-strategy §3/§4).

## `npm run build:lambdas`
`scripts/build-lambdas.mjs` bundles `src/functions/<name>/index.ts` for `records-api` and `reports-api` per ADR-0014
(`--bundle --platform=node --target=node24 --format=esm --minify --sourcemap`, AWS SDK bundled, with a `createRequire`
banner so bundled CommonJS deps can still `require`) and writes `dist/records-api.zip` and `dist/reports-api.zip`.
Each zip holds `index.mjs` and its linked `index.mjs.map` at the root; `Handler: index.handler` in `30-api.yaml`
resolves to `index.mjs` (the Lambda Node.js runtime loads `.mjs` as ESM). The map has root-relative source paths and
no embedded sources. ADR-0014 does not require `NODE_OPTIONS=--enable-source-maps`, so the templates don't set it;
add it to the function `Environment` if mapped stack traces are wanted (it adds some cold-start cost).
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

## §5b probe (records-api direct invoke, non-prod only)
Automates first-deploy §5b (QA-36) with the deployed records-api role. It is reachable **only** by a direct Lambda
invoke whose payload is exactly `{"probe":"qa-5b"}` (no `requestContext`, no other keys); any API Gateway request,
or any other payload, takes the normal path (stub 404). `npm run smoke:deployed` never calls it.

It runs only when the function's `DEPLOY_ENV` is `dev` or `stage`. In `prod`, or when `DEPLOY_ENV` is unset or
unknown, it returns `pass: false` with `refused` and touches nothing. **Never run it against prod.**

```bash
aws lambda invoke --function-name SentinelQA-dev-records-api \
  --cli-binary-format raw-in-base64-out --payload '{"probe":"qa-5b"}' out.json && cat out.json
```

Each run [WRITE]s one new append-only audit event (`TransactWriteItems` via `buildAuditPut`, constant
`attribute_not_exists` condition, entity `qa-5b-probe`, snapshot `isSample: true`), then tries a bare `PutItem` on the
audit table. Expected output (keys vary per run; the event body is never logged or returned):

```json
{ "probe": "qa-5b", "env": "dev", "pass": true,
  "eventKeys": { "PK": "WS#qa-5b-probe#ENT#qa-5b-probe", "SK": "<ISO time>#<ULID>" },
  "auditTransact": { "ok": true, "outcome": "written" },
  "barePutItem": { "ok": true, "outcome": "denied", "error": "AccessDeniedException" } }
```

`pass` is true only if the transaction writes **and** the bare `PutItem` is denied with `AccessDeniedException`
(or `AccessDenied`). A `PutItem` that succeeds, or fails with any other error, is a FAIL. If `auditTransact` fails,
follow first-deploy §5b (stop; Architect's fallback). Re-runs are safe: each adds one new event and overwrites nothing.
The probe stays in place as a non-prod regression check after first deploy.

Prerequisite: the records-api function must have `DEPLOY_ENV` set to `dev`/`stage` in its environment (30-api.yaml
currently sets `ENV_NAME`, not `DEPLOY_ENV`; until that is added, the probe refuses).

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

Only records-api wires it (reports-api returns 404 for the same payload). It fails closed on the function's
`ENV_NAME` (set by `30-api.yaml`): it runs only for `dev` or `stage`; when `ENV_NAME` is unset, empty, `prod` in any
casing, or anything else, it returns `pass: false` with `refused` and touches nothing. **Never run it against prod.**

```bash
aws lambda invoke --function-name SentinelQA-dev-records-api \
  --cli-binary-format raw-in-base64-out --payload '{"probe":"qa-5b"}' out.json && cat out.json
```

**Deploy role permission:** for deploy.yml to run this step, `SentinelQA-<env>-deploy` needs `lambda:InvokeFunction`
on `SentinelQA-<env>-records-api` only. Sid `InvokeRecordsApiProbe` in `00-bootstrap.yaml` (env-scoped-deploy policy)
grants exactly that as of this change; it is **not live** until the env's Bootstrap stack is redeployed with admin
credentials (Vishwas's approval). Until then the deploy role cannot invoke it; run the probe manually as above.

Each run [WRITE]s one new append-only audit event (`TransactWriteItems` via `buildAuditPut`, constant
`attribute_not_exists` condition, entity `qa-5b-probe`, snapshot `isSample: true`), then tries a bare `PutItem` on the
audit table with the same `attribute_not_exists(PK) AND attribute_not_exists(SK)` condition. Expected output (keys vary per run; the event body is never logged or returned):

```json
{ "probe": "qa-5b", "env": "dev", "pass": true,
  "eventKeys": { "PK": "WS#qa-5b-probe#ENT#qa-5b-probe", "SK": "<ISO time>#<ULID>" },
  "auditTransact": { "ok": true, "outcome": "written" },
  "barePutItem": { "ok": true, "outcome": "denied", "error": "AccessDeniedException" },
  "readBack": { "auditEventFound": true, "barePutAbsent": true } }
```

`pass` is true only if the transaction writes **and** the bare `PutItem` is denied with `AccessDeniedException`
(or `AccessDenied`) **and** the read-back confirms it: a consistent, keys-only `GetItem` finds the audit event, and a
`GetItem` of the `<SK>#bare-put` key finds nothing. A `GetItem` error fails that check and is reported by error name
only (`readBack.auditEventError` / `readBack.barePutError`). A `PutItem` that succeeds, or fails with any other error (including
`ConditionalCheckFailedException`), is a FAIL. If `auditTransact` fails,
follow first-deploy §5b (stop; Architect's fallback). Re-runs are safe: each adds one new event and overwrites nothing.
The probe stays in place as a non-prod regression check after first deploy.

**CI:** `deploy.yml` runs this automatically in `deploy-dev` only, right after the smoke step, as its own step guarded
by `env.DEPLOY_ENV == 'dev' || env.DEPLOY_ENV == 'stage'`, with the job's OIDC deploy role. It is **not** run in
`deploy-stage` (run it manually there) and never in prod. The step fails unless the invoke returns `StatusCode` 200, no
`FunctionError`, and `out-5b.json` is valid JSON with `pass: true` (it also fails if the function is missing). It
prints the result JSON.

- **Permanent audit data (expected):** every dev deploy run writes one permanent sample audit event (entity
  `qa-5b-probe`, `isSample: true`) to the append-only dev AuditLog table. It cannot be removed and that is by design.
- **Known blocker:** the deploy role does not currently have `lambda:InvokeFunction` (it appears only in
  `AppRoleBoundary`, which is a ceiling, not a grant). Until a Bootstrap (`00-bootstrap.yaml`) change is approved, the
  CI step will fail with `AccessDeniedException` on the invoke. Run the probe manually as above in the meantime.

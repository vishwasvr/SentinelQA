# SentinelQA — Requirements
Requirements documentation for the Sentinel QA app (https://sentinel-qa.lovable.app/), an AI Quality Manager for AS9100D aerospace suppliers.

Start at [docs/INDEX.md](docs/INDEX.md) → [BRD](docs/requirements/BRD.md).

## Build and deploy scripts
- `npm run build:lambdas` builds `dist/records-api.zip` and `dist/reports-api.zip`.
- `SMOKE_BASE_URL=https://... npm run smoke:deployed` smoke-tests a deployed environment.

See [docs/runbooks/build-and-smoke.md](docs/runbooks/build-and-smoke.md).

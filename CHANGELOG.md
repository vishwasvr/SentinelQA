# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- CI unit tests and coverage gate (QA-32) ([#4](https://github.com/vishwasvr/SentinelQA/pull/4)).
- CI secrets scan (gitleaks) and params JSON Schema check ([#5](https://github.com/vishwasvr/SentinelQA/pull/5)).
- Repository standards: CONTRIBUTING, CHANGELOG, SECURITY.
- `npm run build:lambdas` (deterministic esbuild + zip of records-api/reports-api to `dist/*.zip`) and `npm run smoke:deployed` (post-deploy smoke), used by deploy.yml; stub Lambda handlers returning 404 problem+json ([runbook](docs/runbooks/build-and-smoke.md)).

- records-api §5b first-deploy probe (QA-36): direct invoke with exactly `{"probe":"qa-5b"}` writes one sample audit event through `buildAuditPut` and checks that a bare `PutItem` on the audit table is denied; dev/stage only, refused in prod ([runbook](docs/runbooks/build-and-smoke.md)).
- Bootstrap: deploy role Sid `InvokeRecordsApiProbe` (`lambda:InvokeFunction` on `SentinelQA-<env>-records-api` only) for the deploy.yml §5b probe; pending Bootstrap redeploy.

### Changed
- `build:lambdas` aligned with ADR-0014: node24 target, ESM `index.mjs` + `index.mjs.map` at the zip root (still deterministic).
- Alarm email sourced from a GitHub environment variable; emails forbidden in params ([#6](https://github.com/vishwasvr/SentinelQA/pull/6)).

### Pending (open PRs, not merged)
- Safety-critical shared modules: audit, gate, sample, config, with module specs ([#7](https://github.com/vishwasvr/SentinelQA/pull/7)).

## [0.0.0]

### Added
- Design phase: BRD v1.7.2, architecture, ADRs, specs, runbooks, delivery strategy (#1–#3).

# src

App code (handlers and shared libraries) goes here. Nothing is built yet (QA-32 only adds CI).

Coverage rules (delivery-strategy §3b) apply to `src/**` only. Safety-critical modules
(100% line/branch) are listed in `ci/coverage-policy.json`.
Audit writes must go only through `buildAuditPut` in `src/shared/audit/appendAudit.ts`
(docs/specs/audit-write-path.md); `npm run audit-lint` enforces this.

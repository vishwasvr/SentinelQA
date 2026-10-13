// ESLint flat config. The audit rule (docs/specs/audit-write-path.md §1): only
// src/shared/audit/** may refer to AUDIT_TABLE; everywhere else it is an error.
import tseslint from 'typescript-eslint';

export const auditRule = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "Identifier[name='AUDIT_TABLE']",
      message: 'Audit writes must go through buildAuditPut (src/shared/audit/appendAudit.ts).',
    },
    {
      selector: "Literal[value='AUDIT_TABLE']",
      message: 'Audit writes must go through buildAuditPut (src/shared/audit/appendAudit.ts).',
    },
    {
      selector: "TemplateElement[value.raw=/AUDIT_TABLE/]",
      message: 'Audit writes must go through buildAuditPut (src/shared/audit/appendAudit.ts).',
    },
  ],
};

export default tseslint.config(
  { ignores: ['node_modules/**', 'coverage/**', 'docs/**', 'src/generated/**'] },
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,js,mjs}', 'tests/fixtures/audit-lint/**/*.ts'], rules: auditRule },
  { files: ['src/shared/audit/**'], rules: { 'no-restricted-syntax': 'off' } },
);

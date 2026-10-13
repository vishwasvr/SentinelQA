// Lint fixture: must FAIL the audit rule (writes AUDIT_TABLE outside src/shared/audit/).
const AUDIT_TABLE = process.env.AUDIT_TABLE;
export const put = { Put: { TableName: AUDIT_TABLE, Item: {} } };

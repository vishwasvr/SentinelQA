# ADR-0007: References only, no file storage
- Status: Proposed (follows BR-07)
- Date: 2026-10-13
## Context
The BRD states that certificates, drawings and documents are stored as references/links only.
## Options
No upload (references only) **vs** S3 uploads with malware scanning.
## Decision
No upload endpoints and no user-content buckets. Location fields are validated text/URLs.
## Consequences
Lower controlled-data risk (drawings are often ITAR). Any future upload feature needs a new ADR.

# ADR-0014: Build and packaging of TypeScript Lambdas
Status: **Accepted** (2026-10-13, team agreement). Addresses Developer review #3.

## Context
The templates expect prebuilt zips (`Handler: index.handler`, `Code: {S3Bucket, S3Key}`). CloudFormation updates function code only when `S3Key` (or `S3ObjectVersion`) changes, so a fixed key would silently skip code deploys. The artifact bucket `sentinelqa-<env>-artifacts-<account>` is owned by InfraDeploy's `00-bootstrap` and exported as `SentinelQA-<env>-ArtifactBucketName`.

## Options
| Option | Pros | Cons |
|---|---|---|
| **esbuild bundle per function, zip, S3 key by commit SHA** | Fast, small single-file bundles, tree-shaking, no extra tool in the deploy path | Need a small build script |
| `tsc` + `node_modules` zip | No bundler | Large zips, slow cold starts |
| SAM `sam build` | Built-in packaging | Adds SAM next to plain CloudFormation (ADR-0010) |
| Container images (ECR) | Reproducible | ECR cost and ops overhead at pilot scale |

## Decision
- **Layout:** `src/functions/<name>/index.ts` for each function (`records-api`, `reports-api`, `ddb-export`). Shared code goes in `src/shared/` (gate, SoD, derived status, problem+json, idempotency, EMF metrics) and the reserved AI seam in `src/ai/` (no implementation). The SPA lives in `web/`.
- **Bundling:** `esbuild src/functions/<name>/index.ts --bundle --platform=node --target=node24 --format=esm --minify --sourcemap --outfile=dist/<name>/index.mjs`. `Handler: index.handler` still resolves. The AWS SDK v3 clients are **bundled** (pinned versions, not the runtime copy).
- **Artifact:** `s3://<artifact-bucket>/<commit-sha>/<function>.zip`, uploaded once per commit and never overwritten.
- **Deploy:** the pipeline passes `RecordsApiKey`, `ReportsApiKey` and `ExportFnKey` = `<sha>/<function>.zip`. The templates enforce this with `AllowedPattern`. A new commit means a new key, so CloudFormation always updates the code. Rollback means redeploying the previous SHA.
- The templates import the bucket (`SentinelQA-<env>-ArtifactBucketName`) and no longer take it as a parameter.

## Consequences
- InfraDeploy needs to remove `ArtifactBucket` from the `30-api` and `25-backup` sections of `params/*.json`. The S3 keys stay pipeline-supplied.
- Lint and unit tests run before bundling. Bundles are reproducible from the SHA.

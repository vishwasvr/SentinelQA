# ADR-0015: Restrict the default execute-api endpoint with a CloudFront secret header
Status: **Accepted** (2026-10-13, team agreement). Addresses Developer review #9.

## Context
The HTTP API's default `https://<id>.execute-api…` endpoint is public. Auth is out of scope (ADR-0008) and WAF is deferred (ADR-0011), so anyone who finds the URL could bypass CloudFront and write, or probe the BR-44 422 path.

## Decision
- CloudFront injects `X-Origin-Verify: <secret>` on the `/api/*` origin (`40-web.yaml`, `OriginCustomHeaders`).
- `records-api` and `reports-api` middleware compares it **first, before any auth or gate logic**, using a constant-time compare. Mismatch → 403 `forbidden_origin` (problem+json). The value is never logged.
- **Storage: SSM Parameter Store SecureString** `/sentinelqa/<env>/edge/origin-verify`, encrypted with the AWS managed key `aws/ssm` (no CMK, O-09). It is created out of band by InfraDeploy, because CloudFormation can't create SecureStrings. The Lambdas read it with `GetParameter` (`WithDecryption`) and cache it for 5 minutes.
- The pipeline reads the parameter and passes it to `40-web` as the `NoEcho` parameter `OriginVerifySecret`. CloudFormation cannot resolve `ssm-secure` in CloudFront properties.

| Store | Price (us-east-1, retrieved 2026-10-13) | Verdict |
|---|---|---|
| **SSM SecureString, standard tier** | $0: standard parameters and standard-throughput API calls have no charge (only advanced parameters are billed, $0.05/param-month; [AWSSystemsManager price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSSystemsManager/current/us-east-1/index.json), publication 2026-10-08). KMS requests to `aws/ssm` are covered by the 20k/month free tier thanks to caching | **Chosen** |
| Secrets Manager | $0.40/secret-month + $0.05/10k API calls ([AWSSecretsManager price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSSecretsManager/current/us-east-1/index.json), publication 2026-09-11), i.e. $1.20/month for 3 envs | Managed rotation isn't needed for a static shared header |

## Rotation (manual, quarterly or on suspected exposure)
1. Write `"<new>,<old>"` to the parameter. The middleware accepts any listed value. Wait 5 minutes for the caches to refresh.
2. Redeploy `40-web` with `OriginVerifySecret=<new>` and wait for the distribution to deploy.
3. Write `"<new>"` only.

## Consequences / residual risk
- This is not authentication. Anyone with `cloudfront:GetDistributionConfig` can read the header value. It stops casual direct-endpoint use only, and is replaced by JWT auth (ADR-0008) or WAF (ADR-0011) later.
- IAM (dev #26): `RecordsApiRole` and `ReportsApiRole` (`30-api.yaml`) have `ssm:GetParameter` on `/sentinelqa/<env>/*` (covers the parameter) and `kms:Decrypt` on `key/*` conditioned on `kms:ViaService=ssm.<region>.amazonaws.com`, `kms:EncryptionContext:PARAMETER_ARN` = the origin-verify parameter ARN, and `ForAnyValue:StringEquals kms:ResourceAliases=alias/aws/ssm` (matches the boundary `AllowSsmSecureStringDecrypt` in `00-bootstrap.yaml`). The `kms:ResourceAliases` condition on an AWS managed key is **unverified**; prove it with the dev smoke test (decrypt on cold start). Fallback if it fails: drop that condition, keep ViaService + EncryptionContext.
- (Done by InfraDeploy) the deploy role needs `ssm:GetParameter` on that one parameter, plus `kms:Decrypt` via `ssm.amazonaws.com`. `params/*.json` must **not** contain the value. The app-role boundary may need `kms:Decrypt` with `kms:ViaService=ssm.us-east-1.amazonaws.com` (see the architect review).

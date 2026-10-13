# SentinelQA: Cost Estimate (architecture v0.3: prod / non-prod profiles)

| Item | Value |
|---|---|
| Scope | [architecture-overview.md](architecture-overview.md) v0.3 and [iac/templates](iac/README.md) with `EnvProfile` = **lean** (dev, stage) / **strict** (prod), see [ADR-0013](adr/0013-environment-profiles.md). AI is deferred and not costed. WAF is an optional add-on only |
| Region / pricing | us-east-1, public on-demand list prices, USD, excl. tax |
| Prices retrieved | **2026-10-13** (sources in §2). Re-check before budgeting |
| Method | Usage assumptions (§1) × list prices (§2), scripted. Rounded |

## 0. Summary (year 1)
| Users | Prod, no free tier | Prod, always-free | Non-prod (dev+stage), no free tier | Non-prod, always-free | **Total, no free tier** | **Total, always-free** |
|---|---|---|---|---|---|---|
| **20** | $2.92 | $1.33 | $2.03 | $0.06 | **≈ $4.95** | **≈ $1.39** |
| 50 | $4.13 | $1.89 | $2.23 | $0.14 | ≈ $6.36 | ≈ $2.03 |
| 100 | $6.15 | $2.83 | $2.56 | $0.26 | ≈ $8.71 | ≈ $3.09 |

- **Versus the v0.2 estimate (20 users):** $7.80 → $4.95 without free tier, $3.90 → $1.39 with always-free. By year 7 it drops from about $16 to about $9 without free tier.
- **Prod year 7 (20 users)** (data ≈ 4.7 GB, CMK rotated twice): about **$6.90/month without free tier, $4.20 with always-free**, plus about $0.03 for the recommended backup option C.
- **One-time setup:** about $0 AWS.
- **Optional WAF (not in totals):** about $8.06/month for one prod web ACL.
- **Non-prod "no free tier" is mostly GitHub Actions minutes** ($1.68). In practice those minutes are included in the GitHub plan.

## 1. Usage assumptions
Same as v0.2 (U-1 … U-17), restated by environment:

| # | Assumption | Prod | Non-prod (dev+stage combined) |
|---|---|---|---|
| U-1/2 | Users × API req/user/day × 22 days | 20 × 150 → **66,000 req/mo** | 20% of prod → **13,200 req/mo** |
| U-4/5 | Static requests, egress | 30/user/day. ≈ 1.5 GB/mo | ≈ 0.3 GB/mo |
| U-6 | Lambda | arm64, 512 MB, 150 ms | same |
| U-7/8 | DynamoDB | 20% writes × 12 WRU. 10 RRU per request | same ratios |
| U-10 | Storage growth | ≈ 0.67 GB/yr (audit-dominated) → **≈ 4.7 GB at year 7**, retained | ≈ 0.13 GB/yr. Synthetic, may be purged |
| U-11 | Log retention | 90 days | **7 days** |
| U-12 | Alarms | **5** | **1 per env = 2** (total 7 ≤ 10 free) |
| U-13 | KMS | **1 CMK** (rotation on) | **none** (AWS owned keys) |
| PITR / backup | | PITR on + O-01 option | **none** |
| U-15 | CI minutes | ≈ 100 (prod deploys) | ≈ 280 (dev/stage deploys + PR lint) |
| U-16 | S3 | ≈ 0.6 GB (site, artifacts, CloudTrail) | ≈ 0.4 GB |
| — | Free-tier allocation | Always-free allowances are **account-wide** (single account, D-08). Combined prod + non-prod usage stays within every allowance, so both columns apply them | |

## 2. Unit prices and sources (retrieved 2026-10-13)
Bulk price list base: `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/<service>/current/us-east-1/index.json` (CloudFront, Route 53, WAF: `.../current/index.json`).

| Service | Price used | Source (publication date of file) |
|---|---|---|
| CloudFront | $0.085/GB US egress (first 10 TB). $0.0100 per 10k HTTPS requests (US). **Always free: 1 TB + 10M requests/month** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudFront/current/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudFront/current/index.json) (2026-10-03). Free tier: [CloudFront FAQs](https://aws.amazon.com/cloudfront/faqs/), [flat-rate blog](https://aws.amazon.com/blogs/networking-and-content-delivery/introducing-flat-rate-pricing-plans-with-no-overages/) |
| API Gateway HTTP API | $1.00 per million (first 300M) | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonApiGateway/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonApiGateway/current/us-east-1/index.json) (2026-10-13) |
| Lambda | $0.20 per 1M requests. arm64 $0.0000133334/GB-s (tier 1). **Always free: 1M requests + 400,000 GB-s/month** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/us-east-1/index.json) (2026-10-12). Free tier: [aws.amazon.com/lambda/pricing](https://aws.amazon.com/lambda/pricing/) |
| DynamoDB (on-demand, Standard) | $0.625/M WRU. $0.125/M RRU. Storage $0.25/GB-mo with **first 25 GB-mo free**. PITR $0.20/GB-mo. On-demand backup $0.10/GB-mo. Export to S3 $0.10/GB (full and incremental). Restore $0.15/GB. Provisioned: $0.00065/WCU-h, $0.00013/RCU-h, **25 WCU + 25 RCU free** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonDynamoDB/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonDynamoDB/current/us-east-1/index.json) (2026-09-11) |
| KMS | $1/CMK-month. **First and second rotation each add $1/month** (capped). $0.03 per 10k requests. **20,000 requests/month free** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awskms/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awskms/current/us-east-1/index.json) (2026-09-11). Rotation: [aws.amazon.com/kms/pricing](https://aws.amazon.com/kms/pricing/) |
| CloudWatch | Logs ingest $0.50/GB (standard and Lambda vended first tier). Storage $0.03/GB-mo. Alarm $0.10/standard alarm-month. **Free: 5 GB logs, 10 alarms, 3 dashboards** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/us-east-1/index.json) (2026-10-07). Free tier: [aws.amazon.com/cloudwatch/pricing](https://aws.amazon.com/cloudwatch/pricing/) |
| SNS | Email: first 1,000/month free, then $2.00 per 100k. API: first 1M free | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonSNS/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonSNS/current/us-east-1/index.json) (2026-09-15) |
| S3 | Standard $0.023/GB-mo (first 50 TB). PUT $0.005/1k. GET $0.004/10k. Glacier Flexible Retrieval $0.0036/GB-mo. Glacier Instant Retrieval $0.004/GB-mo | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json) (2026-10-12) |
| AWS Backup (DynamoDB) | Warm $0.10/GB-mo. Cold $0.03/GB-mo (cold needs DynamoDB advanced features opt-in) | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSBackup/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSBackup/current/us-east-1/index.json) (2026-09-28). Cold note: [aws.amazon.com/backup/pricing](https://aws.amazon.com/backup/pricing/) |
| CloudTrail | First copy of management events: free. S3 storage applies | [aws.amazon.com/cloudtrail/pricing](https://aws.amazon.com/cloudtrail/pricing/), [CloudTrail FAQs](https://aws.amazon.com/cloudtrail/faqs/) |
| WAF (optional) | $5/web ACL-month. $1/rule-month. $0.60/M requests. CAPTCHA $0.40/1k attempts | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awswaf/current/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awswaf/current/index.json) (2026-09-14) |
| Route 53 (optional) | $0.50/hosted zone-month (first 25) | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRoute53/current/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRoute53/current/index.json) (2026-09-11) |
| GitHub Actions | Linux 2-core x64 $0.006/min. arm64 $0.005/min. Included minutes/month: Free 2,000, Pro 3,000, Free-for-orgs 2,000, Team 3,000, Enterprise 50,000. **Public repos free** | [GitHub runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| GitHub OIDC / IAM OIDC provider | Free (no AWS line item; IAM is not billed) | — |
| AWS Free Tier (new accounts) | Accounts created **on/after 2025-07-15**: up to $200 credits ($100 at sign-up + up to $100 earned). Free plan lasts 6 months. Credits expire 12 months after account creation. **Always-free** allowances apply on both Free and Paid plans | [aws.amazon.com/free](https://aws.amazon.com/free/), [Free Tier FAQs](https://aws.amazon.com/free/free-tier-faqs/), [API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/) note |

| CloudWatch composite alarm | $0.50 per composite alarm-month | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/us-east-1/index.json) (2026-10-07) |
| KMS AWS-managed / AWS-owned keys | No monthly key charge for AWS managed or AWS owned keys. API requests to AWS-managed keys **are** charged ($0.03/10k) | [aws.amazon.com/kms/pricing](https://aws.amazon.com/kms/pricing/) (2026-10-13) |
| Lambda Function URLs | No separate Function URL line item in the Lambda price list. Requests/duration billed as normal Lambda. **"No extra charge" treated as unverified** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/us-east-1/index.json) (2026-10-12). Throttling behaviour: [Lambda docs, function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html) |
| DynamoDB Standard-IA | Storage $0.10/GB-mo. WRU $0.78/M. RRU $0.155/M. IA PITR price **not found in the price list (unverified)** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonDynamoDB/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonDynamoDB/current/us-east-1/index.json) (2026-09-11) |
| X-Ray (prod tracing) | **Not retrieved (unverified)**. Assumed ≈ $0 at this volume | — |

## 3. Monthly line items, 20 users, year 1

### 3a. Prod (EnvProfile = strict)
| Service | Quantity / month | No free tier | Always-free |
|---|---|---|---|
| CloudFront (requests + egress) | ≈ 79k req, ≈ 1.5 GB | $0.21 | $0.00 |
| API Gateway HTTP API | 66,000 req | $0.07 | $0.07 |
| Lambda (requests + arm64 compute) | 66k req, ≈ 4,950 GB-s | $0.08 | $0.00 |
| DynamoDB on-demand requests | ≈ 158k WRU, 660k RRU | $0.18 | $0.18 |
| DynamoDB storage | ≈ 0.34 GB avg | $0.08 | $0.00 |
| DynamoDB PITR | ≈ 0.34 GB | $0.07 | $0.07 |
| KMS: 1 CMK + ≈ 20k requests | | $1.06 | $1.00 |
| CloudWatch Logs (90 d) | ≈ 0.1 GB | $0.06 | $0.00 |
| CloudWatch alarms | 5 | $0.50 | $0.00 |
| S3 | ≈ 0.6 GB | $0.02 | $0.02 |
| SNS email / CloudTrail | | $0.00 | $0.00 |
| GitHub Actions | ≈ 100 min | $0.60 | $0.00 |
| Backup (O-01, option C, incremental export) | | ≈ $0.00 in year 1 (≈ $0.03 at year 7) | same |
| **Prod total** | | **≈ $2.92** | **≈ $1.33** |

### 3b. Non-prod: dev + stage (EnvProfile = lean)
| Service | Quantity / month | No free tier | Always-free |
|---|---|---|---|
| CloudFront | ≈ 16k req, ≈ 0.3 GB | $0.04 | $0.00 |
| API Gateway HTTP API | 13,200 req | $0.01 | $0.01 |
| Lambda | 13k req | $0.02 | $0.00 |
| DynamoDB requests | | $0.04 | $0.04 |
| DynamoDB storage (AWS owned key) | ≈ 0.07 GB | $0.02 | $0.00 |
| PITR / backup | none | $0.00 | $0.00 |
| KMS | none (AWS owned keys) | $0.00 | $0.00 |
| CloudWatch Logs (7 d) | ≈ 0.02 GB | $0.01 | $0.00 |
| CloudWatch alarms | 2 | $0.20 | $0.00 |
| S3 | ≈ 0.4 GB | $0.01 | $0.01 |
| GitHub Actions | ≈ 280 min | $1.68 | $0.00 |
| **Non-prod total** | | **≈ $2.03** | **≈ $0.06** |

## 4. Free-tier notes
- **Always-free (used above):** Lambda 1M req/400k GB-s, CloudFront 1 TB/10M req, DynamoDB 25 GB storage, KMS 20k requests, CloudWatch 5 GB logs/10 alarms/3 dashboards, SNS 1,000 emails/1M API calls, CloudTrail first copy.
- **12-month legacy free tier** (accounts created **before 2025-07-15**, e.g. API Gateway HTTP API 1M calls/month, S3 5 GB): **unverified**, since current pages describe only the new credit model. Not applied. It would save ≈ $0.11/month at most.
- **New credit-based free tier** (accounts on/after 2025-07-15): up to $200 credits that expire after 12 months. At ≈ $4–8/month the credits would cover **roughly the first year completely**. The Free plan closes after 6 months unless upgraded to Paid, and limits which services are available (not verified which of ours are included). Use the Paid plan for this workload.

## 5. Seven-year retention projection (D-03) and backup options (O-01)
Total DynamoDB data (all envs, 20 users; non-prod is synthetic and not retained, see ADR-0013): ≈ 0.8 GB/year → **5.6 GB at year 7** (≈ 4.7 GB prod).

| Year-end | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| DynamoDB GB (20 users) | 0.8 | 1.6 | 2.4 | 3.2 | 4.0 | 4.8 | 5.6 |
| Storage $/mo (no free tier, $0.25) | 0.20 | 0.40 | 0.60 | 0.80 | 1.00 | 1.21 | 1.41 |
| PITR $/mo ($0.20) | 0.16 | 0.32 | 0.48 | 0.64 | 0.80 | 0.96 | 1.12 |
| Prod KMS key $/mo (1 CMK, rotations) | 1 → 2 | 2 → 3 | 3 | 3 | 3 | 3 | 3 |

At 50 / 100 users, year-7 data is ≈ 14 / 28 GB (storage $3.52 / $7.03, PITR $2.81 / $5.62 per month). With the always-free 25 GB, storage stays free up to ~90 users at year 7.

**KMS rotation:** with annual rotation, each key adds $1/month after the first and second rotation, capped. With the lean profile only prod has a CMK: $1 → $2 → $3/month (the v0.2 baseline with 3 keys went to $9).

**O-01 backup options** (prod table ≈ 4.7 GB at year 7, 20 users; steady-state monthly cost at year 7):

| Option | How | Year-7 cost / month | Notes |
|---|---|---|---|
| A. AWS Backup, monthly full, keep 7 y (84 points), warm | 84 × avg ≈ 2.35 GB ≈ 197 GB × $0.10 | **≈ $19.70** | Simple, restorable in-place |
| A2. Same, moved to cold after 90 days | ≈ 197 GB × $0.03 (+ a few warm) | **≈ $6** | Needs DynamoDB advanced features in AWS Backup |
| B. AWS Backup, **annual** full, keep 7 y (7 points), warm | ≈ 16.5 GB × $0.10 | **≈ $1.65** | Coarser recovery points. PITR still covers 35 days |
| C. DynamoDB **incremental export** to S3 monthly + Glacier Flexible Retrieval | export ≈ 0.06 GB/mo × $0.10 + ≈ 4.7 GB × $0.0036 | **≈ $0.03** (+ one initial full export ≈ $0.10/GB) | Cheapest. Restore = import ($0.15/GB) into a new table. Glacier 90-day minimum and retrieval fees apply. Not WORM, consistent with D-05 |
| C2. Monthly **full** export, kept 7 y in Glacier Flexible | $0.47 export + ≈ 197 GB × $0.0036 | **≈ $1.20** | Self-contained snapshots |

Recommendation for the O-01 decision: **C (incremental export)** or **B (annual AWS Backup)**. Both stay under $2/month for 7 years at 20 users.

## 6. Optional / not in design
| Item | Cost | Status |
|---|---|---|
| **WAF** (deferred, D-11) | $5 web ACL + ~3 rules × $1 + $0.60/M requests ≈ **$8.06/month per ACL** (one ACL on the prod distribution; ×3 if all envs) | Not in totals |
| WAF CAPTCHA | $0.40 per 1,000 attempts | Not in totals |
| Route 53 hosted zone (custom domain) | $0.50/month | Not in design |
| Route 53 DNS queries | **Unverified** (not retrieved). Alias queries to CloudFront are commonly free, also unverified | — |
| Domain registration | **Unverified** (varies by TLD) | One-time/annual |
| ACM public certificate for CloudFront | **Unverified** (commonly $0) | Needed only with a custom domain |
| AWS Budgets | **Unverified** | TODO in template |
| Bedrock / AI | Deferred (D-01) | Will become the dominant variable cost when AI is enabled |

## 7. Savings review: alternatives evaluated
Savings are per month, 20 users, versus the v0.2 design (3 CMKs, PITR everywhere, 15 alarms, 90-day logs in all envs).

| # | Alternative | Saving $/mo (now → year 7) | Trade-off | Recommendation | Affects prior decision? |
|---|---|---|---|---|---|
| S-1 | **Lean non-prod profile**: AWS owned keys, no PITR, 1 alarm/env, 7-day logs, no X-Ray, no deletion protection | **≈ $2.85 now → ≈ $7** (2 CMKs incl. rotations, ≈ $0.8 alarms, PITR, logs) | Non-prod encryption is AWS owned (still encrypted, no key policy or CloudTrail key usage). Non-prod data is unrecoverable, so it must hold synthetic data only | **Adopt** (ADR-0013) | D-03 is applied to **prod only**. Non-prod holds no real records. **Needs confirmation** |
| S-2a | Prod: **1 CMK** instead of 3 (one per env) | Included in S-1 | None for prod | **Adopt** | No (overview §7 previously said "CMK per env") |
| S-2b | Prod: **AWS-managed key** (aws/dynamodb) instead of a CMK | $1 → $3 (key fee), requests still charged | Lose key-policy control, custom rotation, and the ability to disable the key (crypto-shred). CloudTrail still logs use | Optional, **Vishwas to decide** | No D-x. Changes the security posture in overview §7 |
| S-2c | Prod: **AWS owned key** (DynamoDB default) | $1.06 → $3.06 | Also lose CloudTrail visibility of key use. Weakest audit story for an AS9100 supplier | Not recommended | Same as S-2b |
| S-2d | Prod CMK with **automatic rotation off** | $0 now → $2 | Weaker crypto hygiene. Some customer security questionnaires expect rotation | Not recommended | No |
| S-3 | **Lambda Function URL** (behind CloudFront OAC) instead of HTTP API | $0.07 ($0.33 at 100 users) | Loses stage throttling (only reserved concurrency: RPS = 10 × concurrency, 429 beyond). Loses the **JWT authorizer seam** (ADR-0008): auth would move into code or the edge. Two functions mean two origins/URLs. The WAF slot stays on CloudFront (ADR-0011 unaffected) | **Not recommended**. The saving is negligible | Would change ADR-0008 (seam) and O-05 (throttling) |
| S-4 | **Composite alarms** to reduce alarm count | **Negative** ($0.50 each vs $0.10 standard) | Fewer emails, but costs more | Not recommended. Keep ≤ 10 standard alarms (free) | No |
| S-5 | **Fewer prod alarms** (5 → 3) | $0.20 without free tier, $0 with free tier | Less coverage (drop the audit-errors and gate-blocks alarms) | Not recommended | D-10 unaffected |
| S-6 | O-01: **S3 incremental export** vs AWS Backup monthly | vs A: **≈ $19.70 at year 7**. vs B (annual): ≈ $1.60 | Restore = import into a new table (slower, $0.15/GB). Glacier minimums and retrieval fees. Not WORM | **Adopt C** (prod only). B if in-place restore matters | Consistent with D-05. Resolves O-01 **if Vishwas agrees** |
| S-7 | **DynamoDB Standard-IA** for prod AuditLog | No free tier: ≈ $0.66 at year 7 (4.4 GB × $0.15) minus ≈ $0.03 extra requests. **With the 25 GB always-free: negative** (the free storage applies to Standard) | IA request prices are ~25% higher. IA PITR price unverified | **Not now**. Revisit if table storage exceeds 25 GB (≈ 90+ users at year 7) | No |
| S-8 | Prod log retention 90 → 30 days | < $0.01 | Shorter forensic window | Not worth it | O-02 |
| S-9 | arm64 GitHub runners / skip CI on docs-only changes | ≈ $0.40 / up to $1+ (only if beyond included minutes) | Minor | Adopt opportunistically | D-12 unaffected |
| S-10 | Merge dev + stage into one non-prod env | ≈ $0.10 (one alarm) | Loses the rehearsal stage before prod | Not recommended | Changes the environments in overview §10 |
| S-11 | CloudFront flat-rate **Free plan** | ≈ $0 (pay-as-you-go is already free under the 1 TB/10M always-free) | Not available to Free-plan accounts | Not needed | No |

**Unchanged in every profile:** controlled-data gate (D-14), append-only audit with IAM deny (D-05), no file storage (BR-07), SoD rules, API throttling, auth seam, WAF slot (D-11), email alerts (D-10), single account (D-08), us-east-1 (D-02), CloudFormation (D-13), GitHub OIDC (D-12). No BRD requirement is dropped.

## 8. Sensitivity
| | 20 users | 50 users | 100 users |
|---|---|---|---|
| Prod / non-prod / **total**, no free tier | $2.92 / $2.03 / **$4.95** | $4.13 / $2.23 / **$6.36** | $6.15 / $2.56 / **$8.71** |
| Prod / non-prod / **total**, always-free | $1.33 / $0.06 / **$1.39** | $1.89 / $0.14 / **$2.03** | $2.83 / $0.26 / **$3.09** |
| Prod year-7 data | 4.7 GB | 11.7 GB | 23.4 GB |

## 9. Biggest remaining cost drivers
1. **Prod CMK:** $1 → $3/month with rotation (S-2b/c can remove it; decision needed).
2. **GitHub Actions minutes:** $2.28/month only if not covered by the plan.
3. **CloudWatch alarms:** $0.70 (7 alarms) without free tier, $0 with it.
4. **Prod storage + PITR growth:** ≈ $2.10/month at year 7 without free tier (≈ $0.94 PITR with it).
5. Traffic (CloudFront, API GW, Lambda, DynamoDB requests): < $0.60/month combined.

## 10. Caveats
- Usage is assumed, not measured. Validate with Cost Explorer after month 1.
- List prices retrieved 2026-10-13. No tax, Support plan, discounts, or credits included. New accounts (on/after 2025-07-15) get up to $200 credits, which would cover several years at this run rate if the credits didn't expire after 12 months.
- Unverified: legacy 12-month free tier, Function URL "no extra charge", IA PITR price, X-Ray, Route 53 queries, domain registration, ACM, Budgets, Deep Archive.

# SentinelQA: Cost Estimate (architecture v0.5: prod / non-prod, AWS managed keys, export backup, peer-review alarms)

| Item | Value |
|---|---|
| Scope | [architecture-overview.md](architecture-overview.md) v0.5 and [iac/templates](iac/README.md) with `EnvProfile` = **lean** (dev, stage) / **strict** (prod), see [ADR-0013](adr/0013-environment-profiles.md). AI is deferred and not costed. WAF is an optional add-on only |
| Region / pricing | us-east-1, public on-demand list prices, USD, excl. tax |
| Prices retrieved | **2026-10-13** (sources in §2). Re-check before budgeting |
| Method | Usage assumptions (§1) × list prices (§2), scripted. Rounded |

## 0. Summary
**v0.5 change (2026-10-13, peer reviews):** prod alarms go from 6 alarms/6 alarm metrics to **7 alarms/10 alarm metrics**. SystemErrors alarms need one metric per DynamoDB operation, and the backup-health alarm is new. Plus **4 EMF custom metrics** (`ControlledDataBlocked` ×3 envs, `ExportHealthy`). Effect: prod +$1.00 no free tier / +$0.20 always-free; non-prod +$0.60 / $0. The origin-verify secret in SSM standard SecureString costs $0 (Secrets Manager would be $1.20/month for 3 envs; [ADR-0015](adr/0015-origin-verify-header.md)). The daily verify run (≈ 30 Lambda/Scheduler invocations) is $0.

Decisions applied (2026-10-13): **O-08** (7-year retention in prod only), **O-09** (AWS managed/owned keys, no CMKs), **O-01** (monthly incremental DynamoDB export to S3 Glacier).

**Year 1, $/month**

| Users | Prod, no free tier | Prod, always-free | Non-prod, no free tier | Non-prod, always-free | **Combined, no free tier** | **Combined, always-free** |
|---|---|---|---|---|---|---|
| **20** | $3.09 | $0.60 | $2.63 | $0.06 | **≈ $5.72** | **≈ $0.66** |
| 50 | $4.30 | $1.16 | $2.83 | $0.14 | ≈ $7.13 | ≈ $1.30 |
| 100 | $6.31 | $2.10 | $3.16 | $0.26 | ≈ $9.47 | ≈ $2.36 |

**Year 7, $/month** (prod data ≈ 4.7 / 11.7 / 23.4 GB; backup included. Non-prod is shown with accumulated synthetic data, which is conservative because it may be purged)

| Users | Prod, no free tier | Prod, always-free | Non-prod, no free tier | Non-prod, always-free | **Combined, no free tier** | **Combined, always-free** |
|---|---|---|---|---|---|---|
| **20** | $5.06 | $1.48 | $2.85 | $0.06 | **≈ $7.91** | **≈ $1.54** |
| 50 | $9.23 | $3.37 | $3.37 | $0.14 | ≈ $12.60 | ≈ $3.51 |
| 100 | $16.18 | $6.53 | $4.25 | $0.26 | ≈ $20.43 | ≈ $7.57* |

\* At 100 users in year 7, combined DynamoDB storage (≈ 28 GB) exceeds the account-wide 25 GB always-free by ≈ 3 GB (+$0.78, included).

- **Change vs v0.3 (20 users, year 1):** combined $4.95 → **$4.12** without free tier, $1.39 → **$0.46** with always-free. The $1 CMK fee is gone. Backup adds ≈ $0.06, KMS requests ≈ $0.06 (free within 20k).
- **One-time setup:** ≈ $0 AWS, plus the one-time **baseline full export** of the prod tables ($0.10/GB, ≈ $0 at go-live size), a go-live step in the overview pre-go-live checklist (§14).
- **Optional WAF (not in totals):** ≈ $8.06/month.
- **The non-prod "no free tier" figure is ≈ 80% GitHub Actions minutes** ($1.68). These are normally included in the GitHub plan.

## 1. Usage assumptions
Same as v0.2 (U-1 … U-17), restated by environment:

| # | Assumption | Prod | Non-prod (dev+stage combined) |
|---|---|---|---|
| U-1/2 | Users × API req/user/day × 22 days | 20 × 150 → **66,000 req/mo** | 20% of prod → **13,200 req/mo** |
| U-4/5 | Static requests, egress | 30/user/day. ≈ 1.5 GB/mo | ≈ 0.3 GB/mo |
| U-6 | Lambda | arm64, 512 MB, 150 ms | same |
| U-7/8 | DynamoDB | 20% writes × 12 WRU. 10 RRU per request | same ratios |
| U-10 | Storage growth | ≈ 0.67 GB/yr (audit-dominated) → **≈ 4.7 GB at year 7**, retained 7 y (O-08) | ≈ 0.13 GB/yr. Synthetic, not retained (may be purged) |
| U-11 | Log retention | 30 days (O-02) | **7 days** |
| U-12 | Alarms | **6** (incl. export errors) | **1 per env = 2** (total 8 ≤ 10 free) |
| U-13 | KMS | **No CMK** (O-09). AWS managed `aws/dynamodb`, ≈ 0.3 KMS requests per API call | **none** (AWS owned keys) |
| PITR / backup | | PITR on + monthly job of daily incremental exports (2 tables) → Glacier, 7 y | **none** |
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
| KMS | (CMK prices no longer used, O-09) $1/CMK-month. **First and second rotation each add $1/month** (capped). $0.03 per 10k requests. **20,000 requests/month free** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awskms/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awskms/current/us-east-1/index.json) (2026-09-11). Rotation: [aws.amazon.com/kms/pricing](https://aws.amazon.com/kms/pricing/) |
| CloudWatch | Logs ingest $0.50/GB (standard and Lambda vended first tier). Storage $0.03/GB-mo. Alarm **$0.10 per alarm metric-month** (standard; a metric-math alarm is billed per metric). Custom metrics $0.30/metric-month (first 10k), re-checked 2026-10-13 (price list publication 2026-10-07). **Free: 5 GB logs, 10 alarms, 3 dashboards** | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/us-east-1/index.json) (2026-10-07). Free tier: [aws.amazon.com/cloudwatch/pricing](https://aws.amazon.com/cloudwatch/pricing/) |
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
| EventBridge Scheduler | First 14M scheduled invocations/month free, then $1.00/M | [https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSEvents/current/us-east-1/index.json](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSEvents/current/us-east-1/index.json) (2026-09-24) |
| DynamoDB incremental export rules | Billed on change data processed, **10 MB minimum per export**. Window 15 min–24 h within PITR. PITR required | [DynamoDB export: how it works](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/S3DataExport.HowItWorks.html), [Requesting an export](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/S3DataExport_Requesting.html) (2026-10-13) |
| S3 Glacier Flexible Retrieval lifecycle transition request price | **Not found in the price list (unverified)**. ≈ 300 objects/month, so negligible at any plausible rate | — |
| X-Ray (prod tracing) | **Not retrieved (unverified)**. Assumed ≈ $0 at this volume | — |

## 3. Monthly line items, 20 users, year 1

### 3a. Prod (EnvProfile = strict)
| Service | Quantity / month | No free tier | Always-free |
|---|---|---|---|
| CloudFront (requests + egress) | ≈ 79k req, ≈ 1.5 GB | $0.21 | $0.00 |
| API Gateway HTTP API | 66,000 req | $0.07 | $0.07 |
| Lambda (requests + arm64 compute) | 66k req, ≈ 4,950 GB-s | $0.08 | $0.00 |
| DynamoDB on-demand requests | ≈ 158k WRU, 660k RRU | $0.18 | $0.18 |
| DynamoDB storage (`aws/dynamodb`) | ≈ 0.34 GB avg | $0.08 | $0.00 |
| DynamoDB PITR (required for export) | ≈ 0.34 GB | $0.07 | $0.07 |
| KMS: **no key fee** (AWS managed). Requests to `aws/dynamodb` | ≈ 19.8k | $0.06 | $0.00 (≤ 20k free) |
| CloudWatch Logs (90 d) | ≈ 0.1 GB | $0.06 | $0.00 |
| CloudWatch alarm metrics | **10** (7 alarms; SystemErrors metric-math 3 + 2) | $1.00 | $0.20 (12 account-wide, 2 over the 10 free) |
| CloudWatch custom metrics (EMF) | 2 (`ControlledDataBlocked{prod}`, `ExportHealthy`) at $0.30/metric-month | $0.60 | $0.00 (4 account-wide ≤ 10 free) |
| S3 (site, artifacts, CloudTrail; SSE-S3) | ≈ 0.6 GB | $0.02 | $0.02 |
| **Backup:** incremental exports | 2 tables × ≈ 30 daily windows × **10 MB minimum** = 0.6 GB billed | $0.06 | $0.06 |
| Backup: Glacier Flexible storage + PUTs | ≈ 0.3 GB avg, ≈ 300 objects | < $0.01 | < $0.01 |
| Backup: EventBridge Scheduler + export Lambda | 1 invocation, seconds of compute | $0.00 | $0.00 |
| SNS email / CloudTrail | | $0.00 | $0.00 |
| GitHub Actions | ≈ 100 min | $0.60 | $0.00 |
| **Prod total** | | **≈ $3.09** | **≈ $0.60** |

### 3b. Non-prod: dev + stage (EnvProfile = lean): unchanged from v0.3
| Service | Quantity / month | No free tier | Always-free |
|---|---|---|---|
| CloudFront | ≈ 16k req, ≈ 0.3 GB | $0.04 | $0.00 |
| API Gateway HTTP API | 13,200 req | $0.01 | $0.01 |
| Lambda | 13k req | $0.02 | $0.00 |
| DynamoDB requests | | $0.04 | $0.04 |
| DynamoDB storage (AWS owned key) | ≈ 0.07 GB | $0.02 | $0.00 |
| PITR / backup / KMS | none | $0.00 | $0.00 |
| CloudWatch Logs (7 d) | ≈ 0.02 GB | $0.01 | $0.00 |
| CloudWatch alarms | 2 | $0.20 | $0.00 |
| CloudWatch custom metrics (EMF) | 2 (`ControlledDataBlocked{dev,stage}`) | $0.60 | $0.00 |
| S3 | ≈ 0.4 GB | $0.01 | $0.01 |
| GitHub Actions | ≈ 280 min | $1.68 | $0.00 |
| **Non-prod total** | | **≈ $2.63** | **≈ $0.06** |

## 4. Free-tier notes
- **Always-free (used above):** Lambda 1M req/400k GB-s, CloudFront 1 TB/10M req, DynamoDB 25 GB storage, KMS 20k requests, CloudWatch 5 GB logs/10 alarms/3 dashboards, SNS 1,000 emails/1M API calls, CloudTrail first copy.
- **12-month legacy free tier** (accounts created **before 2025-07-15**, e.g. API Gateway HTTP API 1M calls/month, S3 5 GB): **unverified**, since current pages describe only the new credit model. Not applied. It would save ≈ $0.11/month at most.
- **New credit-based free tier** (accounts on/after 2025-07-15): up to $200 credits that expire after 12 months. At ≈ $4–8/month the credits would cover **roughly the first year completely**. The Free plan closes after 6 months unless upgraded to Paid, and limits which services are available (not verified which of ours are included). Use the Paid plan for this workload.

## 5. Seven-year retention projection (D-03 as amended: prod only) and backup (O-01, decided)
Prod DynamoDB data, 20 users: ≈ 0.67 GB/year → **≈ 4.7 GB at year 7**. Non-prod is synthetic and not retained.

| Year-end (prod, 20 users) | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| DynamoDB GB | 0.67 | 1.3 | 2.0 | 2.7 | 3.3 | 4.0 | 4.7 |
| Storage $/mo (no free tier, $0.25) | 0.17 | 0.33 | 0.50 | 0.67 | 0.84 | 1.00 | 1.17 |
| PITR $/mo ($0.20) | 0.13 | 0.27 | 0.40 | 0.54 | 0.67 | 0.80 | 0.94 |
| Export backup $/mo (exports + Glacier) | 0.06 | 0.07 | 0.07 | 0.07 | 0.08 | 0.08 | 0.08 |
| KMS key fee | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Backup mechanics and cost (decided O-01):**
- An incremental export window must be **15 min to 24 h**. Both ends must lie within the 35-day PITR window. So the "monthly" job (day 2, 07:00 UTC) issues ≈ 30 daily-window exports per table for the previous month.
- Each incremental export is billed on the change data processed, with a **10 MB minimum**. At 20–50 users the minimum dominates (≈ 0.6 GB billed/month ≈ $0.06). At 100 users, audit changes (≈ 12 MB/day) exceed it, ≈ $0.09/month.
- Exported files land in S3 Standard and transition to Glacier Flexible Retrieval ($0.0036/GB-mo) after 1 day. At year 7 that's ≈ 4.7 GB stored ≈ $0.02/month. They expire after 2,557 days.
- One-time baseline full export at $0.10/GB of table size. ≈ $0 at go-live.
- **Restore** = import the baseline full export ($0.15/GB) + replay the incrementals (custom job, O-10, deferred to the pre-go-live checklist). Glacier retrieval adds $0.02/GB standard (Deep Archive price shown, Flexible Retrieval retrieval price **unverified**).

For comparison, the options not chosen: monthly AWS Backup warm ≈ $19.70/month at year 7, cold ≈ $6, annual AWS Backup ≈ $1.65.

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
| S-1 | **Lean non-prod profile**: AWS owned keys, no PITR, 1 alarm/env, 7-day logs, no X-Ray, no deletion protection | **≈ $2.85 now → ≈ $7** (2 CMKs incl. rotations, ≈ $0.8 alarms, PITR, logs) | Non-prod encryption is AWS owned (still encrypted, no key policy or CloudTrail key usage). Non-prod data is unrecoverable, so it must hold synthetic data only | **Adopted** (ADR-0013) | D-03 amended: **prod only (O-08, decided)** |
| S-2a | Prod: 1 CMK instead of 3 | Included in S-1 | None for prod | Superseded by S-2b | — |
| S-2b | Prod: **AWS-managed key** (aws/dynamodb) instead of a CMK | $1 → $3 (key fee), requests still charged | Lose key-policy control, custom rotation, and the ability to disable the key (crypto-shred). CloudTrail still logs use | **Adopted (O-09)**: AWS managed keys everywhere they're applicable, SSE-S3 for buckets | Overview §7 updated |
| S-2c | Prod: **AWS owned key** (DynamoDB default) | $1.06 → $3.06 | Also lose CloudTrail visibility of key use. Weakest audit story for an AS9100 supplier | Not recommended | Same as S-2b |
| S-2d | Prod CMK with **automatic rotation off** (moot, no CMK) | $0 now → $2 | Weaker crypto hygiene. Some customer security questionnaires expect rotation | Not recommended | No |
| S-3 | **Lambda Function URL** (behind CloudFront OAC) instead of HTTP API | $0.07 ($0.33 at 100 users) | Loses stage throttling (only reserved concurrency: RPS = 10 × concurrency, 429 beyond). Loses the **JWT authorizer seam** (ADR-0008): auth would move into code or the edge. Two functions mean two origins/URLs. The WAF slot stays on CloudFront (ADR-0011 unaffected) | **Not recommended**. The saving is negligible | Would change ADR-0008 (seam) and O-05 (throttling) |
| S-4 | **Composite alarms** to reduce alarm count | **Negative** ($0.50 each vs $0.10 standard) | Fewer emails, but costs more | Not recommended. Keep ≤ 10 standard alarms (free) | No |
| S-5 | **Fewer prod alarm metrics** (10 → 8, e.g. Domain SystemErrors on TransactWriteItems only) | $0.20 without free tier, $0.20 with free tier | Less coverage (drop the audit-errors and gate-blocks alarms) | Not recommended | D-10 unaffected |
| S-6 | O-01: **S3 incremental export** vs AWS Backup monthly | vs A: **≈ $19.70 at year 7**. vs B (annual): ≈ $1.60 | Restore = import into a new table (slower, $0.15/GB). Glacier minimums and retrieval fees. Not WORM | **Adopted (O-01)**: monthly job, daily-window incremental exports | Consistent with D-05. Restore runbook deferred to pre-go-live (O-10) |
| S-7 | **DynamoDB Standard-IA** for prod AuditLog | No free tier: ≈ $0.66 at year 7 (4.4 GB × $0.15) minus ≈ $0.03 extra requests. **With the 25 GB always-free: negative** (the free storage applies to Standard) | IA request prices are ~25% higher. IA PITR price unverified | **Not now**. Revisit if table storage exceeds 25 GB (≈ 90+ users at year 7) | No |
| S-8 | Prod log retention 90 → 30 days | < $0.01 | Shorter forensic window | **Adopted** (Vishwas, 2026-10-13) | O-02 |
| S-9 | arm64 GitHub runners / skip CI on docs-only changes | ≈ $0.40 / up to $1+ (only if beyond included minutes) | Minor | Adopt opportunistically | D-12 unaffected |
| S-10 | Merge dev + stage into one non-prod env | ≈ $0.10 (one alarm) | Loses the rehearsal stage before prod | Not recommended | Changes the environments in overview §10 |
| S-11 | CloudFront flat-rate **Free plan** | ≈ $0 (pay-as-you-go is already free under the 1 TB/10M always-free) | Not available to Free-plan accounts | Not needed | No |

**Unchanged in every profile:** controlled-data gate (D-14), append-only audit with IAM deny (D-05), no file storage (BR-07), SoD rules, API throttling, auth seam, WAF slot (D-11), email alerts (D-10), single account (D-08), us-east-1 (D-02), CloudFormation (D-13), GitHub OIDC (D-12). No BRD requirement is dropped.

## 8. Sensitivity
See §0 (20 / 50 / 100 users, year 1 and year 7). Variable cost ≈ $0.04–0.05 per user per month in year 1. Storage + PITR growth add ≈ $0.10 per user per month by year 7 (no free tier).

## 9. Biggest remaining cost drivers
1. **GitHub Actions minutes:** $2.28/month only if not covered by the plan.
2. **Prod DynamoDB storage + PITR growth:** ≈ $2.10/month at year 7 (20 users) without free tier. PITR ($0.94) is the part the free tier doesn't cover.
3. **CloudWatch alarms + custom metrics:** $1.20 alarm metrics (12) + $1.20 custom metrics (4) without free tier; $0.20 with it (alarm metrics 11–12).
4. **Traffic** (CloudFront, API GW, Lambda, DynamoDB requests): < $0.60/month combined.
5. **Backup exports:** ≈ $0.06–0.09/month (10 MB minimum per export dominates).
6. **KMS requests to `aws/dynamodb`:** ≈ $0.06 without free tier at 20 users. ≈ $0.24 at 100 users after the 20k free.

## 9a. O-03 separate prod account (decided 2026-10-13): cost effect, NOT re-priced
- The account itself, AWS Organizations and IAM Identity Center (SSO) have no fee.
- Always-free allowances apply **per account**, so prod and non-prod no longer share them (§1 U-16 note, §3 "account-wide" columns, the ≈ 3 GB DynamoDB overage in §0). Splitting should lower or keep the total, not raise it. The account-wide figures in §0–§3 are now out of date for prod.
- New in the prod account: a second CloudTrail trail's S3 storage (first management copy is free) and a budget alarm (AWS Budgets pricing still unverified, §6).
- A newly created account may get the credit-based free tier (§4), which is unverified for accounts created under an existing Organization.
- **TODO before go-live (OI-7):** re-price §0–§3 per account. I haven't recalculated these numbers.

## 10. Caveats
- Usage is assumed, not measured. Validate with Cost Explorer after month 1.
- List prices retrieved 2026-10-13. No tax, Support plan, discounts, or credits included. New accounts (on/after 2025-07-15) get up to $200 credits, which would cover several years at this run rate if the credits didn't expire after 12 months.
- Unverified: Glacier Flexible lifecycle-transition and retrieval prices, S3 lifecycle 128 KB minimum-size behaviour (O-11, deferred to the pre-go-live checklist), legacy 12-month free tier, Function URL "no extra charge", IA PITR price, X-Ray, Route 53 queries, domain registration, ACM, Budgets, Deep Archive.

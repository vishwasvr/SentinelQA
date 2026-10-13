# SentinelQA: Cost Estimate (architecture v0.2)

| Item | Value |
|---|---|
| Scope | Current design only: [architecture-overview.md](architecture-overview.md) v0.2 and [iac/templates](iac/README.md). AI/Bedrock is deferred and **not** costed. WAF is shown as an optional add-on only |
| Region / pricing | us-east-1, public on-demand list prices, USD, excl. tax |
| Prices retrieved | **2026-10-13** (all sources below). Prices change, so re-check before budgeting |
| Method | Usage assumptions (§1) × list prices (§2), computed with a small script. Figures rounded |

## 0. Summary
| Users | Monthly, **no free tier** | Monthly, **with always-free tiers** | Notes |
|---|---|---|---|
| **20 (baseline)** | **≈ $7.80** | **≈ $3.90** | Year 1. Fixed costs dominate |
| 50 | ≈ $9.20 | ≈ $4.60 | |
| 100 | ≈ $11.70 | ≈ $5.70 | |

- **One-time setup (AWS):** ≈ $0. The deploys themselves are free, and resources start billing pro-rata. Engineering effort is not priced. Optional domain registration is unverified (§6).
- **Year-7 run rate at 20 users** (storage grown, KMS rotations billed): ≈ $16/month without free tier, ≈ $11/month with always-free tiers, plus any O-01 backup option (§5).
- **Optional WAF add-on** (not in totals): ≈ $8/month per web ACL (§6).
- **Bottom line:** at this scale the bill is set by **fixed per-resource fees** (KMS keys, alarms, CI minutes), not by traffic.

## 1. Usage assumptions (explicit)
| # | Assumption | Value (20 users) |
|---|---|---|
| U-1 | Active users / working days | 20 users, 22 working days/month |
| U-2 | API requests per user per day | 150 (page loads, lists, saves) → **66,000 prod API req/month** |
| U-3 | Non-prod traffic (dev + stage) | +20% of prod → **79,200 API req/month total** |
| U-4 | Static asset requests | 30/user/day (SPA cached by browser) → ~95k CloudFront requests total incl. API |
| U-5 | Response sizes | API 10 KB avg. Static 2 MB per user per day → **≈ 1.9 GB CloudFront egress/month** |
| U-6 | Lambda | arm64, 512 MB, 150 ms avg → ≈ 5,900 GB-s/month |
| U-7 | Writes | 20% of API requests are writes. Each is a transaction (record ≈ 2 KB + audit event ≈ 4 KB with snapshot); transactional writes cost 2× → ≈ 12 WRU per write |
| U-8 | Reads | ≈ 10 RRU per API request (queries/lists, eventually consistent mixes ignored) |
| U-9 | Records created | ≈ 25 domain items/user/month (CAPA/NCMR/SCAR, FAI rows, calibration, training, docs, …). The BRD ROI default is 20 records/month for drafting. GSIs with ALL projection ≈ 3× item storage |
| U-10 | Storage growth | audit ≈ 53 MB/month + domain ≈ 3 MB/month (prod, 20 users) → **≈ 0.67 GB/year prod, ≈ 0.8 GB/year incl. non-prod; ≈ 5.6 GB after 7 years** |
| U-11 | Logs | ≈ 1.5 KB per invocation (structured, no bodies) → ≈ 0.12 GB/month. 90-day retention |
| U-12 | Alarms | 5 per environment × 3 = **15 alarms** (the template has 1 per env; overview plans ~5) |
| U-13 | KMS | 3 CMKs (one per env) with annual rotation. ≈ 0.3 KMS requests per API call (DynamoDB caches data keys) |
| U-14 | SNS email | < 100 alarm emails/month |
| U-15 | Deploys / CI | 20 deploys/month × 3 envs × 5 min + 40 PR lint runs × 2 min ≈ **380 Linux minutes/month** |
| U-16 | S3 | site bundle ~5 MB × 3, Lambda artifacts, CloudTrail logs: ≈ 1 GB total, ~500 PUT, ~20k GET |
| U-17 | Scaling | All traffic and storage scale linearly with users. Fixed fees do not |

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

## 3. Monthly line items: 20 users, year 1
"With free tier" applies **always-free** allowances only (they don't expire). 12-month legacy offers and credits are **not** applied (see §4).

| Service | Quantity / month | No free tier | With always-free | Free tier type |
|---|---|---|---|---|
| CloudFront requests | ≈ 95,000 | $0.10 | $0.00 | Always free (10M) |
| CloudFront egress | ≈ 1.9 GB | $0.16 | $0.00 | Always free (1 TB) |
| S3 (site, artifacts, CloudTrail) | ≈ 1 GB, 500 PUT, 20k GET | $0.03 | $0.03 | (12-month legacy only) |
| API Gateway HTTP API | 79,200 req | $0.08 | $0.08 | (12-month legacy only) |
| Lambda requests | 79,200 | $0.02 | $0.00 | Always free |
| Lambda compute (arm64) | ≈ 5,900 GB-s | $0.08 | $0.00 | Always free |
| DynamoDB writes (on-demand) | ≈ 190k WRU | $0.12 | $0.12 | On-demand: no free requests |
| DynamoDB reads (on-demand) | ≈ 792k RRU | $0.10 | $0.10 | On-demand: no free requests |
| DynamoDB storage | ≈ 0.4 GB avg in year 1 | $0.10 | $0.00 | Always free (25 GB) |
| DynamoDB PITR | ≈ 0.4 GB | $0.08 | $0.08 | None |
| KMS CMKs | 3 keys | $3.00 | $3.00 | None |
| KMS requests | ≈ 24k | $0.07 | $0.01 | Always free (20k) |
| CloudWatch Logs ingest + storage | 0.12 GB, 90-day retention | $0.07 | $0.00 | Always free (5 GB) |
| CloudWatch alarms | 15 | $1.50 | $0.50 | Always free (10) |
| SNS email | < 100 | $0.00 | $0.00 | Always free (1,000) |
| CloudTrail (1 trail, mgmt events) | — | $0.00 | $0.00 | First copy free |
| GitHub Actions (private repo) | ≈ 380 min | $2.28 | $0.00 | Included in GitHub plan |
| Route 53 / ACM | **Not in design** (CloudFront default domain) | $0.00 | $0.00 | — |
| **Total** | | **≈ $7.80** | **≈ $3.90** | |

**DynamoDB on-demand vs provisioned:** the 25 WCU/25 RCU always-free applies only to *provisioned* mode. At this load, provisioned mode at the minimum of 1 WCU/1 RCU per table and GSI would be free, saving ≈ $0.20/month. That isn't worth the throttling risk and autoscaling configuration. On-demand stays (overview §3).

## 4. Free-tier notes
- **Always-free (used above):** Lambda 1M req/400k GB-s, CloudFront 1 TB/10M req, DynamoDB 25 GB storage, KMS 20k requests, CloudWatch 5 GB logs/10 alarms/3 dashboards, SNS 1,000 emails/1M API calls, CloudTrail first copy.
- **12-month legacy free tier** (accounts created **before 2025-07-15**, e.g. API Gateway HTTP API 1M calls/month, S3 5 GB): **unverified**, since current pages describe only the new credit model. Not applied. It would save ≈ $0.11/month at most.
- **New credit-based free tier** (accounts on/after 2025-07-15): up to $200 credits that expire after 12 months. At ≈ $4–8/month the credits would cover **roughly the first year completely**. The Free plan closes after 6 months unless upgraded to Paid, and limits which services are available (not verified which of ours are included). Use the Paid plan for this workload.

## 5. Seven-year retention projection (D-03) and backup options (O-01)
Total DynamoDB data (all envs, 20 users): ≈ 0.8 GB/year → **5.6 GB at year 7** (≈ 4.7 GB prod).

| Year-end | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| DynamoDB GB (20 users) | 0.8 | 1.6 | 2.4 | 3.2 | 4.0 | 4.8 | 5.6 |
| Storage $/mo (no free tier, $0.25) | 0.20 | 0.40 | 0.60 | 0.80 | 1.00 | 1.21 | 1.41 |
| PITR $/mo ($0.20) | 0.16 | 0.32 | 0.48 | 0.64 | 0.80 | 0.96 | 1.12 |
| KMS keys $/mo (3 keys, rotations) | 3 → 6 | 6 → 9 | 9 | 9 | 9 | 9 | 9 |

At 50 / 100 users, year-7 data is ≈ 14 / 28 GB (storage $3.52 / $7.03, PITR $2.81 / $5.62 per month). With the always-free 25 GB, storage stays free up to ~90 users at year 7.

**KMS rotation:** with annual rotation, each key adds $1/month after the first and second rotation. 3 keys cost $3 → $6 → $9/month, which **becomes the largest single line item**.

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

## 7. Sensitivity
| | 20 users | 50 users | 100 users |
|---|---|---|---|
| API requests/month (all envs) | 79k | 198k | 396k |
| Monthly, no free tier (year 1) | ≈ $7.80 | ≈ $9.20 | ≈ $11.70 |
| Monthly, always-free (year 1) | ≈ $3.90 | ≈ $4.60 | ≈ $5.70 |
| Year-7 DynamoDB data | 5.6 GB | 14 GB | 28 GB |
| Year-7 run rate, no free tier (incl. KMS $9, excl. backup) | ≈ $16.10 | ≈ $21.10 | ≈ $29.40 |

Variable cost is only ≈ $0.05/user/month. Even 10× the request assumption (1,500 req/user/day) adds only ≈ $3–4/month at 20 users.

## 8. Biggest cost drivers
1. **KMS customer-managed keys:** $3/month now, $9/month after two rotations (3 env keys).
2. **GitHub Actions minutes:** $2.28/month if the plan's included minutes are exhausted or unavailable. $0 on the included quota or a public repo.
3. **CloudWatch alarms:** $1.50/month for 15 alarms ($0.50 after the 10 free).
4. **Long-term backup choice (O-01):** $0.03 to $20/month at year 7, depending on the option.
5. **DynamoDB storage + PITR growth:** ≈ $2.50/month at year 7 (20 users). Audit snapshots dominate growth.
6. Traffic-based items (CloudFront, API GW, Lambda, DynamoDB requests): < $1/month combined.

## 9. Cost-saving levers
- **One CMK for dev+stage** (or AWS-owned/AWS-managed keys in dev) saves $1–6/month. Keep the CMK in prod. This trades away some env isolation (D-08).
- Fewer alarms in dev/stage (≤ 10 total stays free).
- **Keep audit snapshots lean:** store diffs, not full snapshots. Halves storage growth and PITR.
- Disable PITR in dev. Shorten log retention in dev to 7–14 days.
- Use arm64 runners ($0.005/min) or the included GitHub minutes. Skip CI on docs-only commits.
- Backup option C or B instead of monthly AWS Backup.
- Use an account created on/after 2025-07-15 on the **Paid** plan to use up to $200 credits (≈ year 1 free).
- Keep CloudFront caching of static assets (already Managed-CachingOptimized).

## 10. Caveats
- All usage numbers are assumptions (§1), not measurements. Validate with Cost Explorer after the first month of a pilot.
- Prices are list prices retrieved 2026-10-13. No discounts, Savings Plans, tax or support plans included (AWS Support plans are not priced).
- DynamoDB GSI write amplification and transaction costs are approximated (U-7). Actual WRU depends on item sizes.

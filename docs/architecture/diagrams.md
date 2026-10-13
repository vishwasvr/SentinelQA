# SentinelQA — Architecture Diagrams
Status: v0.5 (peer-review changes 2026-10-13, BRD v1.4). See [architecture-overview.md](architecture-overview.md).

## Component view (current build)
```mermaid
flowchart LR
  U[Browser SPA] -->|HTTPS| CF[CloudFront]
  CF -->|/*| S3W[(S3 static site<br/>private, OAC)]
  CF -->|/api/* + X-Origin-Verify| API[API Gateway HTTP API<br/>explicit routes from openapi.yaml, throttling]
  API --> RA[Lambda records-api TS<br/>controlled-data gate,<br/>workflow, SoD]
  API --> RP[Lambda reports-api TS<br/>dashboard, trends]
  RA --> DDB[(DynamoDB Domain<br/>WS# keys, prod 7y, no TTL, PITR)]
  RA -->|append put + read timeline<br/>IAM deny update/delete| AL[(DynamoDB AuditLog<br/>7y)]
  RP --> DDB
  RA & RP --> SSM[SSM params<br/>PLACEHOLDER weights/thresholds, markers,<br/>origin-verify SecureString]
  RA & RP -.EMF logs.-> CW[CloudWatch metrics + alarms] --> SNS[SNS -> Email]
  DDB & AL -.SystemErrors.-> CW
  KMS[AWS managed key aws/dynamodb - prod<br/>AWS owned key - dev/stage] -.encrypts.-> DDB & AL
  SCH[EventBridge Scheduler<br/>monthly export + daily verify, prod] --> EXP[Lambda ddb-export]
  EXP -.ExportHealthy heartbeat.-> CW
  EXP -->|daily-window incremental exports| DDB & AL
  EXP --> BK[(S3 exports SSE-S3<br/>-> Glacier, expire 7y)]
  subgraph Deferred[Deferred - not built]
    BR[Bedrock AI /api/ai/*]
    COG[Cognito authorizer]
    WAF[WAF / CAPTCHA]
  end
  BR -.seam.-> API
  COG -.seam.-> API
  WAF -.seam.-> CF
```

## Write with controlled-data gate
```mermaid
sequenceDiagram
  actor U as User
  participant SPA
  participant RA as records-api
  participant DDB as Domain
  participant AL as AuditLog
  U->>SPA: enter description, tick "no controlled data"
  SPA->>RA: POST /api/quality-records (Idempotency-Key) {text, attestation:true, actorName}
  alt X-Origin-Verify missing/wrong
    RA-->>SPA: 403 forbidden_origin
  else attestation missing
    RA-->>SPA: 400 gate:attestation_required
  else marker hit, whole-word case-insensitive (ITAR/EAR/CUI/22 CFR 120-130...)
    RA-->>SPA: 422 gate:controlled_marker (blocked, text not logged)
  else ok
    RA->>RA: validate + SoD rules
    RA->>DDB: TransactWrite record (version check, ClientRequestToken)
    RA->>AL: + conditional Put event (actor, snapshot, attested)
    RA-->>SPA: 201
  end
```

## Environments (single account, us-east-1)
```mermaid
flowchart TB
  GH[GitHub Actions OIDC] --> R1[deploy role dev] --> D[SentinelQA-dev-* stacks]
  GH --> R2[deploy role stage] --> S[SentinelQA-stage-* stacks]
  GH -->|prod env required reviewer| R3[deploy role prod] --> P[SentinelQA-prod-* stacks]
  subgraph ACC[AWS account 723940054516 - us-east-1]
    D
    S
    P
  end
```

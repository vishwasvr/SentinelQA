# SentinelQA — Architecture Diagrams
Status: v0.2 (decisions resolved 2026-10-13). See [architecture-overview.md](architecture-overview.md).

## Component view (current build)
```mermaid
flowchart LR
  U[Browser SPA] -->|HTTPS| CF[CloudFront]
  CF -->|/*| S3W[(S3 static site<br/>private, OAC)]
  CF -->|/api/*| API[API Gateway HTTP API<br/>throttling]
  API --> RA[Lambda records-api TS<br/>controlled-data gate,<br/>workflow, SoD]
  API --> RP[Lambda reports-api TS<br/>dashboard, trends]
  RA --> DDB[(DynamoDB Domain<br/>WS# keys, 7y, no TTL)]
  RA -->|append only<br/>IAM deny update/delete| AL[(DynamoDB AuditLog<br/>7y)]
  RP --> DDB
  RA & RP --> SSM[SSM params<br/>weights, thresholds, markers]
  RA & RP --> CW[CloudWatch alarms] --> SNS[SNS -> Email]
  KMS[KMS CMK per env] -.encrypts.-> DDB & AL
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
  SPA->>RA: POST /api/quality-records {text, attestation:true, actorName}
  alt attestation missing
    RA-->>SPA: 400 gate:attestation_required
  else keyword marker hit (ITAR/EAR/CUI...)
    RA-->>SPA: 422 gate:controlled_marker (blocked, text not logged)
  else ok
    RA->>RA: validate + SoD rules
    RA->>DDB: TransactWrite record
    RA->>AL: + conditional Put event (actor, snapshot, attested)
    RA-->>SPA: 201
  end
```

## Environments (single account, us-east-1)
```mermaid
flowchart TB
  GH[GitHub Actions OIDC] --> R1[deploy role dev] --> D[SentinelQA-dev-* stacks]
  GH --> R2[deploy role stage] --> S[SentinelQA-stage-* stacks]
  GH -->|manual approval| R3[deploy role prod] --> P[SentinelQA-prod-* stacks]
  subgraph ACC[One AWS account - us-east-1]
    D
    S
    P
  end
```

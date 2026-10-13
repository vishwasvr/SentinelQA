// SKELETON ONLY: stubs with TODOs
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import type { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import type { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';

export class SecurityStack extends Stack {
  readonly key: kms.Key;
  constructor(s: Construct, id: string, p: StackProps) { super(s, id, p);
    this.key = new kms.Key(this, 'DataKey', { enableKeyRotation: true });
    // TODO: CloudTrail, Config (prod), Budgets
  }
}
export class AiStack extends Stack {
  readonly modelArn: string; readonly guardrailArn: string;
  constructor(s: Construct, id: string, p: StackProps & { modelId: string }) { super(s, id, p);
    this.modelArn = `arn:aws:bedrock:${this.region}::foundation-model/${p.modelId}`; // or inference-profile ARN (D-02)
    this.guardrailArn = 'TODO'; // bedrock.CfnGuardrail: denied topics, word filters (ITAR/EAR/CUI markers), PII
    // TODO: SSM params: marker list, confidence threshold 0.75, promptVersion
  }
}
export class AuditArchiveStack extends Stack {
  constructor(s: Construct, id: string, p: StackProps & { auditTable: ITableV2; key: kms.IKey }) { super(s, id, p);
    // TODO: S3 bucket objectLockEnabled + default retention COMPLIANCE (D-03/D-05); archiver Lambda on stream
  }
}
export class WebStack extends Stack {
  constructor(s: Construct, id: string, p: StackProps & { httpApi: HttpApi; wafRateLimit?: number }) { super(s, id, p);
    // TODO: S3 site (BlockPublicAccess, OAC), CloudFront behaviors (/api/* -> httpApi), WAFv2 (CLOUDFRONT scope, us-east-1)
  }
}
export class ObservabilityStack extends Stack {
  constructor(s: Construct, id: string, p: StackProps & { alarmEmail?: string }) { super(s, id, p);
    // TODO: SNS topic, alarms per BR-30 on namespace SentinelQA/Agent, dashboard
  }
}

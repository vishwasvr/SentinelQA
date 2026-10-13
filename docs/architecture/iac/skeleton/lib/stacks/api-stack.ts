// SKELETON ONLY
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import type { DataStack } from './data-stack';
import type { AiStack } from './other-stacks';

export interface ApiProps extends StackProps { data: DataStack; ai: AiStack }

export class ApiStack extends Stack {
  readonly httpApi: HttpApi;
  constructor(scope: Construct, id: string, p: ApiProps) {
    super(scope, id, p);
    this.httpApi = new HttpApi(this, 'HttpApi' /* authorizer slot: ADR-0008 */);

    const recordsApi = new lambda.NodejsFunction(this, 'RecordsApi', { entry: 'src/records-api.ts', timeout: Duration.seconds(10) });
    p.data.domain.grantReadWriteData(recordsApi);           // TODO: tighten to non-delete actions in prod
    recordsApi.addToRolePolicy(new iam.PolicyStatement({ actions: ['dynamodb:PutItem'], resources: [p.data.auditLog.tableArn] }));

    const aiGateway = new lambda.NodejsFunction(this, 'AiGateway', { entry: 'src/ai-gateway.ts', timeout: Duration.seconds(29) });
    aiGateway.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:ApplyGuardrail'],
      resources: [p.ai.modelArn, p.ai.guardrailArn],           // pinned ARNs only (D-01)
    }));
    p.data.agentTask.grant(aiGateway, 'dynamodb:PutItem', 'dynamodb:UpdateItem');

    const reportsApi = new lambda.NodejsFunction(this, 'ReportsApi', { entry: 'src/reports-api.ts' });
    p.data.agentTask.grantReadData(reportsApi);

    // Explicit deny: audit log is append-only (ADR-0006)
    for (const fn of [recordsApi, aiGateway, reportsApi]) {
      fn.addToRolePolicy(new iam.PolicyStatement({ effect: iam.Effect.DENY,
        actions: ['dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:BatchWriteItem'], resources: [p.data.auditLog.tableArn] }));
    }
    // TODO routes: /api/{records,suppliers,sq,po-checks,fai,calibration-instruments,training,documents,roles,qms}, /api/ai/draft, /api/agent-tasks(.csv)
  }
}

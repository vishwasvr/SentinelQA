// SKELETON ONLY
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';

export interface DataProps extends StackProps { key: kms.IKey; isProd: boolean }

export class DataStack extends Stack {
  readonly domain: ddb.TableV2; readonly auditLog: ddb.TableV2; readonly agentTask: ddb.TableV2;
  constructor(scope: Construct, id: string, p: DataProps) {
    super(scope, id, p);
    const common = {
      partitionKey: { name: 'PK', type: ddb.AttributeType.STRING },  // WS#<workspaceId>...
      sortKey: { name: 'SK', type: ddb.AttributeType.STRING },
      billing: ddb.Billing.onDemand(),
      encryption: ddb.TableEncryptionV2.customerManagedKey(p.key),
      pointInTimeRecovery: true,
      deletionProtection: p.isProd,
      removalPolicy: p.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    };
    this.domain = new ddb.TableV2(this, 'Domain', { ...common,
      globalSecondaryIndexes: [
        { indexName: 'GSI1', partitionKey: { name: 'GSI1PK', type: ddb.AttributeType.STRING }, sortKey: { name: 'GSI1SK', type: ddb.AttributeType.STRING } }, // stage / severityRank#openedAt (BR-14)
        { indexName: 'GSI2', partitionKey: { name: 'GSI2PK', type: ddb.AttributeType.STRING }, sortKey: { name: 'dueDate', type: ddb.AttributeType.STRING } }, // due / need-by / re-eval (BR-15, BR-18)
      ] });
    this.auditLog = new ddb.TableV2(this, 'AuditLog', { ...common, dynamoStream: ddb.StreamViewType.NEW_IMAGE });
    this.agentTask = new ddb.TableV2(this, 'AgentTask', { ...common, timeToLiveAttribute: 'expiresAt' }); // retention: D-03
  }
}

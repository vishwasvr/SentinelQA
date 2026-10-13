// SKELETON ONLY: not synthesized or deployed. See ../../README.md
import { App } from 'aws-cdk-lib';
import { DataStack } from '../lib/stacks/data-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { SecurityStack, AiStack, WebStack, ObservabilityStack, AuditArchiveStack } from '../lib/stacks/other-stacks';

const app = new App();
const envName = app.node.tryGetContext('env') ?? 'dev'; // dev | stage | prod
const cfg = app.node.tryGetContext(envName);            // account, region, modelId, ...
const env = { account: cfg.account, region: cfg.region ?? 'us-east-1' };
const p = `SentinelQA-${envName}`;

const sec = new SecurityStack(app, `${p}-Security`, { env });
const data = new DataStack(app, `${p}-Data`, { env, key: sec.key, isProd: envName === 'prod' });
if (envName === 'prod') new AuditArchiveStack(app, `${p}-AuditArchive`, { env, auditTable: data.auditLog, key: sec.key });
const ai = new AiStack(app, `${p}-Ai`, { env, modelId: cfg.modelId });
const api = new ApiStack(app, `${p}-Api`, { env, data, ai });
new WebStack(app, `${p}-Web`, { env, httpApi: api.httpApi, wafRateLimit: cfg.wafRateLimit });
new ObservabilityStack(app, `${p}-Observability`, { env, alarmEmail: cfg.alarmEmail });

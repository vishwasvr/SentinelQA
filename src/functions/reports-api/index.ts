// reports-api Lambda entry (ADR-0014 layout; also serves GET /api/config). STUB: routes not implemented yet;
// every request returns a 404 problem+json envelope so the artifact can be built, deployed and smoke-tested.
import { notImplementedRouter } from '../../shared/http.js';

export const handler = notImplementedRouter('reports-api');

import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { unzipSync } from 'fflate';
import { buildAll, deterministicZip, FUNCTIONS } from '../../scripts/build-lambdas.mjs';

const root = resolve(__dirname, '../..');

describe('build-lambdas', () => {
  it('zip is byte-identical for identical input', () => {
    const files = { 'b.js': new TextEncoder().encode('b'), 'a.js': new TextEncoder().encode('a') };
    expect(Buffer.from(deterministicZip(files)).equals(Buffer.from(deterministicZip(files)))).toBe(true);
  });

  it('builds records-api and reports-api zips with a loadable index.js at the root', async () => {
    expect(FUNCTIONS).toEqual(['records-api', 'reports-api']);
    const out = mkdtempSync(join(tmpdir(), 'lambdas-'));
    const files: string[] = await buildAll(root, out);
    expect(files.map((f) => f.slice(out.length + 1))).toEqual(['records-api.zip', 'reports-api.zip']);
    const again: string[] = await buildAll(root, mkdtempSync(join(tmpdir(), 'lambdas-')));
    for (const [i, f] of files.entries()) {
      expect(readFileSync(f).equals(readFileSync(again[i]))).toBe(true);
      const entries = unzipSync(readFileSync(f));
      expect(Object.keys(entries)).toEqual(['index.js']);
      const dir = mkdtempSync(join(tmpdir(), 'unz-'));
      const p = join(dir, 'index.js');
      (await import('node:fs')).writeFileSync(p, entries['index.js']);
      const mod = createRequire(import.meta.url)(p);
      const r = await mod.handler({ rawPath: '/nope', requestContext: { http: { method: 'GET' } } });
      expect(r.statusCode).toBe(404);
    }
  }, 30000);
});

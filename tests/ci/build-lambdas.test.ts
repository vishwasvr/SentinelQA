import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';
import { buildAll, deterministicZip, FUNCTIONS } from '../../scripts/build-lambdas.mjs';

const root = resolve(__dirname, '../..');

describe('build-lambdas', () => {
  it('zip is byte-identical for identical input', () => {
    const files = { 'b.js': new TextEncoder().encode('b'), 'a.js': new TextEncoder().encode('a') };
    expect(Buffer.from(deterministicZip(files)).equals(Buffer.from(deterministicZip(files)))).toBe(true);
  });

  it('builds records-api and reports-api zips with a loadable index.mjs (+ map) at the root', async () => {
    expect(FUNCTIONS).toEqual(['records-api', 'reports-api']);
    const out = mkdtempSync(join(tmpdir(), 'lambdas-'));
    const files: string[] = await buildAll(root, out);
    expect(files.map((f) => f.slice(out.length + 1))).toEqual(['records-api.zip', 'reports-api.zip']);
    const again: string[] = await buildAll(root, mkdtempSync(join(tmpdir(), 'lambdas-')));
    for (const [i, f] of files.entries()) {
      expect(readFileSync(f).equals(readFileSync(again[i]))).toBe(true);
      const entries = unzipSync(readFileSync(f));
      expect(Object.keys(entries).sort()).toEqual(['index.mjs', 'index.mjs.map']);
      const code = new TextDecoder().decode(entries['index.mjs']);
      expect(code).toMatch(/\/\/# sourceMappingURL=index\.mjs\.map\s*$/);
      expect(code).not.toContain(root);
      const map = JSON.parse(new TextDecoder().decode(entries['index.mjs.map']));
      expect(map.sources.every((s: string) => !s.startsWith('/'))).toBe(true);
      const dir = mkdtempSync(join(tmpdir(), 'unz-'));
      const fs = await import('node:fs');
      for (const [n, b] of Object.entries(entries)) fs.writeFileSync(join(dir, n), b);
      const mod = await import(pathToFileURL(join(dir, 'index.mjs')).href);
      const r = await mod.handler({ rawPath: '/nope', requestContext: { http: { method: 'GET' } } });
      expect(r.statusCode).toBe(404);
    }
  }, 30000);
});

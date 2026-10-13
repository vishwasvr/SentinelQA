#!/usr/bin/env node
// Build the Lambda zips consumed by .github/workflows/deploy.yml (ADR-0014):
//   src/functions/<name>/index.ts -> esbuild (node24, ESM, minified, linked sourcemap) -> dist/<name>.zip containing
//   index.mjs + index.mjs.map at the zip root (ADR-0014; 30-api.yaml Handler: index.handler resolves to index.mjs). Deterministic: fixed entry order and mtimes, no build timestamps.
import { build } from 'esbuild';
import { zipSync } from 'fflate';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FUNCTIONS = ['records-api', 'reports-api'];
// 1980-01-01 12:00 local: zip (DOS) times are local wall-clock fields, so this encodes the same bytes in any TZ
// and keeps the zip (and manifest sha256) stable.
export const FIXED_MTIME = new Date(1980, 0, 1, 12, 0, 0);

/** Zip { name: Uint8Array } deterministically (sorted names, fixed mtime, fixed compression level). */
export function deterministicZip(files) {
  const entries = {};
  for (const name of Object.keys(files).sort()) entries[name] = [files[name], { mtime: FIXED_MTIME, level: 9 }];
  return zipSync(entries, { mtime: FIXED_MTIME });
}

/** Bundle one function in memory; returns { 'index.mjs': bytes, 'index.mjs.map': bytes }. */
export async function bundle(root, name) {
  const res = await build({
    entryPoints: [join(root, 'src/functions', name, 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    minify: true,
    sourcemap: 'linked',
    sourcesContent: false,
    // Bundled CJS deps (AWS SDK) may call require(); give the ESM bundle one.
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    legalComments: 'none',
    write: false,
    outfile: 'index.mjs',
    absWorkingDir: root,
    logLevel: 'warning',
  });
  const pick = (suffix) => res.outputFiles.find((f) => f.path.endsWith(suffix)).contents;
  return { 'index.mjs': pick('index.mjs'), 'index.mjs.map': pick('index.mjs.map') };
}

export async function buildAll(root, outDir = join(root, 'dist'), names = FUNCTIONS) {
  mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const name of names) {
    const file = join(outDir, `${name}.zip`);
    writeFileSync(file, deterministicZip(await bundle(root, name)));
    written.push(file);
  }
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), '../..');
  buildAll(root).then(
    (files) => files.forEach((f) => console.log(`built ${f}`)),
    (err) => { console.error(err); process.exit(1); },
  );
}

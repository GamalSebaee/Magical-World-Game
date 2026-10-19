/**
 * Post-build: bundles src/sw/sw.ts and injects the precache manifest for everything in out/
 * (decision D12: bundler-agnostic injectManifest over the static export).
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { injectManifest } from '@serwist/build';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'out');
if (!fs.existsSync(outDir)) throw new Error('out/ not found: run `next build` first');

const tmp = path.join(root, '.next', 'sw.bundle.js');
await build({
  entryPoints: [path.join(root, 'src/sw/sw.ts')],
  outfile: tmp,
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
});

const { count, size, warnings } = await injectManifest({
  swSrc: tmp,
  swDest: path.join(outDir, 'sw.js'),
  globDirectory: outDir,
  globPatterns: ['**/*.{html,js,css,json,txt,png,svg,webp,mp3,webmanifest,woff2,ico}'],
  globIgnores: ['sw.js', '**/*.map'],
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  // Hashed Next.js assets are immutable; their URL is already the revision.
  dontCacheBustURLsMatching: /^_next\/static\//,
});
for (const w of warnings) console.warn(`sw: ${w}`);
console.log(`sw: precache ${count} files, ${(size / 1024 / 1024).toFixed(2)} MB → out/sw.js`);

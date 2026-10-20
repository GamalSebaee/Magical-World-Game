/**
 * Measures the JavaScript each exported page makes a modern browser download (gzip -9), from a
 * finished `pnpm build`. `noModule` scripts (legacy polyfills) are skipped: browsers that support
 * modules never fetch them. Phaser is lazy and only loads with the canvas, so it is listed apart.
 * Usage: tsx scripts/perf/bundle-size.ts [--budget=200]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('out');
const budgetKb = Number(process.argv.find((a) => a.startsWith('--budget='))?.split('=')[1] ?? 200);
const gz = (file: string) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;

const pages = ['index.html', 'map/index.html', 'world/animal-forest/index.html', 'level/af-01/index.html', 'level/af-01/play/index.html', 'stickers/index.html', 'parent/index.html'];
let over = false;
for (const page of pages) {
  const html = fs.readFileSync(path.join(OUT, page), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="(\/_next\/static\/[^"]+\.js)"[^>]*>/g)]
    .filter((m) => !/\bnoModule\b/i.test(m[0]))
    .map((m) => m[1]!);
  const kb = [...new Set(scripts)].reduce((n, s) => n + gz(path.join(OUT, s)), 0) / 1024;
  if (kb > budgetKb) over = true;
  console.log(`${kb > budgetKb ? '✖' : '✓'} ${page.padEnd(32)} ${kb.toFixed(0).padStart(4)} KB`);
}
const chunks = fs.readdirSync(path.join(OUT, '_next/static/chunks')).filter((f) => f.endsWith('.js'));
const phaser = chunks.map((f) => path.join(OUT, '_next/static/chunks', f)).find((f) => fs.readFileSync(f, 'utf8').includes('Phaser v'));
if (phaser) console.log(`  Phaser chunk (lazy)                ${(gz(phaser) / 1024).toFixed(0).padStart(4)} KB`);
console.log(`budget: ${budgetKb} KB per page`);
process.exit(over ? 1 : 0);

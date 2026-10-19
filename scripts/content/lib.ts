import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const CONTENT_DIR = path.join(ROOT, 'src/content');
export const PUBLIC_DIR = path.join(ROOT, 'public');

export function publicFileExists(publicPath: string): boolean {
  return fs.existsSync(path.join(PUBLIC_DIR, publicPath));
}

function idsIn(dir: string, suffix: string): string[] {
  const full = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(suffix))
    .map((f) => f.slice(0, -suffix.length))
    .sort();
}

export function contentFilesOnDisk() {
  return { worlds: idsIn('worlds', '.world.json'), levels: idsIn('levels', '.level.json') };
}

export function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, rel), 'utf8')) as T;
}

export function writeJson(rel: string, value: unknown) {
  fs.writeFileSync(path.join(CONTENT_DIR, rel), JSON.stringify(value, null, 2) + '\n');
}

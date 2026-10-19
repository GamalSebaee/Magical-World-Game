/** Renders public/icons/icon.svg to the PNG sizes the web manifest needs. Usage: tsx scripts/assets/render-icons.ts */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const dir = path.resolve(import.meta.dirname, '../../public/icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(dir, `icon-${size}.png`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log('icons: wrote icon-192.png, icon-512.png');

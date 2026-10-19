import { expect, type Page } from '@playwright/test';
import type { MwgTestHooks } from '../../src/game/core/testHooks';

declare global {
  interface Window {
    __MWG__: MwgTestHooks;
  }
}

/** Collects console errors and requests to other origins, failing the test if any occur (G13, 09 §6). */
export function guardPage(page: Page) {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && !url.protocol.startsWith('data') && !url.protocol.startsWith('blob')) {
      foreign.push(r.url());
    }
  });
  return {
    assertClean() {
      expect(errors, 'console errors').toEqual([]);
      expect(foreign, 'requests to other origins').toEqual([]);
    },
  };
}

export async function bootToPlay(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !!window.__MWG__);
}

export async function openMap(page: Page) {
  await bootToPlay(page);
  await page.getByTestId('play').click();
  await page.waitForURL('**/map/');
  await page.waitForFunction(() => window.__MWG__.sceneObjects().length === 3, null, { timeout: 15_000 });
}

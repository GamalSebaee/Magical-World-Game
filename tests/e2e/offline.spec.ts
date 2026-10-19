import { expect, test } from '@playwright/test';
import { bootToPlay, guardPage } from './helpers';

test.describe('offline (R-33, T-OFF)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Service-worker offline emulation is reliable in Chromium only');

  test('reports offline-ready only once cached, then works with no network', async ({ page, context }) => {
    const guard = guardPage(page);
    await bootToPlay(page);
    const status = page.getByTestId('offline-status');
    await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('play')).toBeVisible({ timeout: 15_000 });
    await expect(status).toHaveAttribute('data-state', 'ready');

    await page.getByTestId('play').click();
    await page.waitForURL('**/map/');
    await page.waitForFunction(() => window.__MWG__.sceneObjects().length === 3, null, { timeout: 15_000 });

    // A deep link that was never visited also works offline: the whole export is precached.
    await page.goto('/map/');
    await page.waitForFunction(() => window.__MWG__.sceneObjects().length === 3, null, { timeout: 15_000 });
    await context.setOffline(false);
    guard.assertClean();
  });
});

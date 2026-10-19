import { expect, test } from '@playwright/test';
import { audioHistory, guardPage, playA1A2, setupChild, startAf01, waitForPhase } from './helpers';

test.describe('offline (R-33, G6, T-OFF)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Service-worker offline emulation is reliable in Chromium only');

  test('after caching, AF-01 plays fully offline with all its audio', async ({ page, context }) => {
    test.setTimeout(120_000);
    const guard = guardPage(page);
    await setupChild(page);
    await page.goto('/');
    await expect(page.getByTestId('offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('play')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('play').click();
    await page.waitForURL('**/profiles/');
    await page.getByTestId('profile-card').first().click();
    await page.waitForURL('**/welcome/');
    await page.getByTestId('welcome-play').click();
    await page.waitForURL('**/map/');
    await page.waitForFunction(() => window.__MWG__.sceneObjects().length >= 1, null, { timeout: 15_000 });
    await startAf01(page);
    await playA1A2(page);
    await page.getByTestId('speech-together').click();
    await expect(page.getByTestId('speech-continue')).toBeVisible({ timeout: 10_000 });
    await waitForPhase(page, 'ready', 'af01.a3');
    await page.getByTestId('speech-continue').click();
    await page.waitForURL('**/result/');
    const h = await audioHistory(page);
    expect(h).toContain('/assets/audio/ar/af01.a1.instruction.mp3');
    expect(h).toContain('/assets/audio/ar/word.animals.dog.mp3');
    await context.setOffline(false);
    guard.assertClean();
  });
});

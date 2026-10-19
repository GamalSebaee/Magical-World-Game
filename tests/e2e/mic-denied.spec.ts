import { expect, test } from '@playwright/test';
import { waitForPhase } from './helpers';
import { chromiumOnly, toSpeaking } from './mic-helpers';

// No fake UI and no permission: Chromium denies the prompt.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream'] }, permissions: [] });

test.describe('microphone: denied (G5, T-MIC)', () => {
  test.skip(chromiumOnly, 'Fake capture devices are Chromium-only');

  test('denied permission falls back to "say it with Nono" and the activity completes', async ({ page }) => {
    await toSpeaking(page);
    // Denied either up front (Permissions API) or when the prompt is answered: both end the same way.
    const record = page.getByTestId('speech-record');
    await expect(page.getByTestId('speech-together').or(record)).toBeVisible({ timeout: 10_000 });
    if (await record.isVisible()) await record.click();
    await expect(page.getByTestId('speech-together')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('speech-record')).toHaveCount(0);
    await expect(page.getByTestId('mic-note')).toBeVisible();
    await page.getByTestId('speech-together').click();
    await expect(page.getByTestId('speech-continue')).toBeVisible({ timeout: 10_000 });
    await waitForPhase(page, 'ready', 'af01.a3');
    await page.getByTestId('speech-continue').click();
    await page.waitForURL('**/result/');
  });
});

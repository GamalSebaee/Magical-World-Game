import { expect, test } from '@playwright/test';
import { playA1A2, setupChild, startAf01 } from './helpers';
import { chromiumOnly, fakeMic, openedStreams, trackStreams } from './mic-helpers';

test.use(fakeMic('voice.wav'));

test.describe('microphone: off (G5, T-MIC)', () => {
  test.skip(chromiumOnly, 'Fake capture devices are Chromium-only');

  test('with the microphone off, getUserMedia is never called', async ({ page }) => {
    await trackStreams(page);
    await setupChild(page, { mic: 'off' });
    await startAf01(page);
    await playA1A2(page);
    await page.getByTestId('speech-together').click();
    await expect(page.getByTestId('speech-continue')).toBeVisible({ timeout: 10_000 });
    expect(await openedStreams(page)).toBe(0);
  });
});

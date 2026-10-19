import { expect, test } from '@playwright/test';
import { activity } from './helpers';
import { chromiumOnly, fakeMic, toSpeaking } from './mic-helpers';

test.use(fakeMic('silence.wav'));

test.describe('microphone: silence (G5, T-MIC)', () => {
  test.skip(chromiumOnly, 'Fake capture devices are Chromium-only');

  test('a silent recording asks to try again, never "wrong"', async ({ page }) => {
    await toSpeaking(page);
    await page.getByTestId('speech-record').click();
    await page.waitForTimeout(1500);
    await page.getByTestId('speech-record').click();
    await expect.poll(async () => ((await activity(page))!.m as { results: string[] }).results).toEqual(['recorded_silence']);
  });
});

import { expect, test } from '@playwright/test';
import { activity, guardPage, waitForPhase } from './helpers';
import { chromiumOnly, fakeMic, liveTracks, openedStreams, toSpeaking, trackStreams } from './mic-helpers';

test.use(fakeMic('voice.wav'));

test.describe('microphone: voice (G5, T-MIC)', () => {
  test.skip(chromiumOnly, 'Fake capture devices are Chromium-only');

  test('records, detects voice, offers hear-me, and stops the tracks after each recording', async ({ page }) => {
    const guard = guardPage(page);
    await trackStreams(page);
    await toSpeaking(page);
    await page.getByTestId('speech-record').click();
    await expect(page.getByTestId('recording-indicator')).toBeVisible();
    expect(await liveTracks(page)).toBe(1);
    await page.waitForTimeout(1500);
    await page.getByTestId('speech-record').click();
    await expect(page.getByTestId('speech-hear-me')).toBeVisible();
    await expect.poll(async () => ((await activity(page))!.m as { results: string[] }).results).toEqual(['recorded_voice_detected']);
    expect(await liveTracks(page)).toBe(0);
    await page.getByTestId('speech-hear-me').click();
    await waitForPhase(page, 'ready', 'af01.a3');
    await page.getByTestId('speech-continue').click();
    await page.waitForURL('**/result/');
    // No audio is ever persisted (G10).
    const stored = await page.evaluate(async () => {
      const keys = await caches.keys();
      let blobs = 0;
      for (const k of keys) for (const r of await (await caches.open(k)).keys()) if (r.url.startsWith('blob:')) blobs++;
      return { blobs, counts: await window.__MWG__.storageCounts() };
    });
    expect(stored.blobs).toBe(0);
    guard.assertClean();
  });

  test('a recording stops by itself at the time limit', async ({ page }) => {
    await toSpeaking(page);
    await page.getByTestId('speech-record').click();
    await expect(page.getByTestId('recording-indicator')).toBeVisible();
    await expect(page.getByTestId('speech-hear-me')).toBeVisible({ timeout: 8000 });
  });

  test('leaving mid-recording stops the microphone (T-MIC-08)', async ({ page }) => {
    await trackStreams(page);
    await toSpeaking(page);
    await page.getByTestId('speech-record').click();
    await expect(page.getByTestId('recording-indicator')).toBeVisible();
    await page.getByTestId('hud-pause').click();
    await page.getByTestId('pause-map').click();
    await page.waitForURL('**/map/');
    await expect.poll(() => liveTracks(page)).toBe(0);
    expect(await openedStreams(page)).toBe(1);
  });
});

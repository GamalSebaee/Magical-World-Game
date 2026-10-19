import path from 'node:path';
import { type Page } from '@playwright/test';
import { playA1A2, setupChild, startAf01 } from './helpers';

export const fixture = (name: string) => path.resolve(import.meta.dirname, '../fixtures/audio', name);
export const fakeMic = (wav: string) => ({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${fixture(wav)}`] },
  permissions: ['microphone'],
});

/** Records every MediaStream the page opens, so tests can check tracks were stopped. */
export async function trackStreams(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await orig(c);
      w.__streams.push(s);
      return s;
    };
  });
}
export const liveTracks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);
export const openedStreams = (page: Page) => page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.length);

export async function toSpeaking(page: Page) {
  await setupChild(page, { mic: 'on' });
  await startAf01(page);
  await playA1A2(page);
}


/** Fake capture devices are Chromium-only; other browsers are covered by the manual checklist. */
export const chromiumOnly = ({ browserName }: { browserName: string }) => browserName !== 'chromium';

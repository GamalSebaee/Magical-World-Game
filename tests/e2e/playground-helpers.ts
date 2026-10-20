import { expect, test, type Page } from '@playwright/test';
import { activity, sceneObjects } from './helpers';

type Point = { x: number; y: number };

/** Opens one activity alone in the playground, full-window like a phone, and unlocks audio. */
export async function openActivity(page: Page, id: string, extra = '') {
  await page.goto(`/dev/playground/?a=${id}&bare=1${extra}`);
  await page.waitForFunction((a) => window.__MWG__?.activity()?.activityId === a && window.__MWG__.sceneObjects().length > 0, id, { timeout: 15_000 });
  // A tap on empty background unlocks audio (06 §3) and does nothing in the game.
  const vp = page.viewportSize()!;
  await tapAt(page, { x: vp.width / 2, y: 4 });
  await page.waitForFunction(() => window.__MWG__.activity()?.phase === 'ready', null, { timeout: 15_000 });
}

export const state = async <M>(page: Page) => (await activity(page))!.m as M;

export async function centreOf(page: Page, id: string): Promise<Point> {
  const o = (await sceneObjects(page)).find((x) => x.id === id);
  if (!o) throw new Error(`no scene object ${id}`);
  return { x: o.rect.x + o.rect.width / 2, y: o.rect.y + o.rect.height / 2 };
}

export async function rectOf(page: Page, id: string) {
  const o = (await sceneObjects(page)).find((x) => x.id === id);
  if (!o) throw new Error(`no scene object ${id}`);
  return o.rect;
}

const isTouch = () => !!test.info().project.use.hasTouch;

export async function tapAt(page: Page, p: Point) {
  if (isTouch()) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

export const tapId = async (page: Page, id: string) => tapAt(page, await centreOf(page, id));

/**
 * A real drag from `from` to `to`: mouse on desktop, touch events (via CDP) on touch devices.
 * `during` runs while the finger/button is still down (e.g. rotate the screen).
 */
export async function drag(page: Page, from: Point, to: Point, opts: { steps?: number; during?: () => Promise<void> } = {}) {
  const steps = opts.steps ?? 12;
  const path = Array.from({ length: steps }, (_, i) => ({ x: from.x + ((to.x - from.x) * (i + 1)) / steps, y: from.y + ((to.y - from.y) * (i + 1)) / steps }));
  if (!isTouch()) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const p of path) await page.mouse.move(p.x, p.y);
    await opts.during?.();
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
  await touch('touchStart', from);
  for (const p of path) await touch('touchMove', p);
  await opts.during?.();
  await touch('touchEnd');
  await cdp.detach();
}

export async function expectNoLayoutProblems(page: Page) {
  // The playground re-checks every 500 ms.
  await page.waitForTimeout(700);
  await expect(page.getByTestId('play')).toHaveAttribute('data-problems', '');
}

export async function waitForPhaseIn(page: Page, phases: string[]) {
  await page.waitForFunction((ps) => ps.includes(window.__MWG__.activity()?.phase ?? ''), phases, { timeout: 20_000 });
}

/** Clip ids played so far, in order (from the audio history of URLs). */
export async function clipsPlayed(page: Page): Promise<string[]> {
  const urls = await page.evaluate(() => window.__MWG__.audioHistory());
  return urls.map((u) => u.split('/').pop()!.replace(/\.mp3$/, ''));
}

/** Sound effects played so far (clip ids). */
export async function sfxPlayed(page: Page): Promise<string[]> {
  const urls = await page.evaluate(() => window.__MWG__.sfxHistory());
  return urls.map((u) => u.split('/').pop()!.replace(/\.mp3$/, ''));
}

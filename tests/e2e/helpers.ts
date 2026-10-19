import { expect, test, type Page } from '@playwright/test';
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
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) foreign.push(r.url());
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

/** First run: splash → parent setup → avatar → welcome → map. */
export async function setupChild(page: Page, opts: { mic?: 'on' | 'off'; language?: 'ar' | 'en' | 'mixed' } = {}) {
  await bootToPlay(page);
  await page.getByTestId('play').click();
  await page.waitForURL('**/parent/setup/');
  if (opts.language && opts.language !== 'ar') await page.getByTestId(`language-${opts.language}`).check();
  if (opts.mic === 'on') await page.getByTestId('mic-on').check();
  await page.getByTestId('child-name').fill('Mariam');
  await page.getByTestId('setup-done').click();
  await page.waitForURL('**/avatar/**');
  await page.getByTestId('avatar-save').click();
  await page.waitForURL('**/welcome/');
  await page.getByTestId('welcome-play').click();
  await page.waitForURL('**/map/');
  await waitForObjects(page, 1);
}

export const sceneObjects = (page: Page) => page.evaluate(() => window.__MWG__.sceneObjects());
export const activity = (page: Page) => page.evaluate(() => window.__MWG__.activity());
export const audioHistory = (page: Page) => page.evaluate(() => window.__MWG__.audioHistory());

export async function waitForObjects(page: Page, min: number) {
  await page.waitForFunction((n) => window.__MWG__?.sceneObjects().length >= n, min, { timeout: 15_000 });
}

/** Taps a canvas object by id, with touch on touch devices and the mouse otherwise. */
export async function tapObject(page: Page, id: string) {
  const o = (await sceneObjects(page)).find((x) => x.id === id);
  if (!o) throw new Error(`no scene object ${id}`);
  const x = o.rect.x + o.rect.width / 2;
  const y = o.rect.y + o.rect.height / 2;
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

export async function waitForPhase(page: Page, phase: string, activityId?: string) {
  await page.waitForFunction(
    ([ph, id]) => {
      const a = window.__MWG__?.activity();
      return !!a && a.phase === ph && (!id || a.activityId === id);
    },
    [phase, activityId] as const,
    { timeout: 20_000 },
  );
}

/** Map → Animal Forest → AF-01 intro → Start. */
export async function startAf01(page: Page) {
  await tapObject(page, 'animal-forest');
  await page.waitForURL('**/world/animal-forest/');
  await page.getByTestId('level-af-01').click();
  await page.waitForURL('**/level/af-01/');
  await page.getByTestId('intro-start').click();
  await page.waitForURL('**/level/af-01/play/**');
  await waitForPhase(page, 'ready', 'af01.a1');
}

/** Plays activities 1 and 2 correctly (with one wrong pick in round 1). */
export async function playA1A2(page: Page) {
  await tapObject(page, 'cat');
  await waitForPhase(page, 'ready', 'af01.a1');
  await tapObject(page, 'dog');
  await waitForPhase(page, 'ready', 'af01.a2');
  await tapObject(page, 'cat'); // not yet: the question is "where's the dog?"
  await waitForPhase(page, 'ready', 'af01.a2');
  await tapObject(page, 'dog');
  await waitForPhase(page, 'ready', 'af01.a2');
  await tapObject(page, 'cat');
  await waitForPhase(page, 'ready', 'af01.a3');
}

export async function expectObjectsInViewport(page: Page) {
  const vp = page.viewportSize()!;
  for (const o of await sceneObjects(page)) {
    expect(o.rect.x, o.id).toBeGreaterThanOrEqual(-0.5);
    expect(o.rect.y, o.id).toBeGreaterThanOrEqual(-0.5);
    expect(o.rect.x + o.rect.width, o.id).toBeLessThanOrEqual(vp.width + 0.5);
    expect(o.rect.y + o.rect.height, o.id).toBeLessThanOrEqual(vp.height + 0.5);
    expect(Math.min(o.rect.width, o.rect.height), o.id).toBeGreaterThanOrEqual(64);
  }
}

/** Every visible, enabled button in the page is at least `min` CSS px in both directions. */
export async function expectLargeButtons(page: Page, min = 64) {
  const small = await page.evaluate((m) => {
    // Adult-only controls (data-adult) follow the 44 px adult guideline instead.
    return [...document.querySelectorAll('main button:not([data-adult])')]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        const s = getComputedStyle(b);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0' && !(b as HTMLButtonElement).disabled;
      })
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width < m || r.height < m;
      })
      .map((b) => `${b.getAttribute('aria-label') ?? b.textContent} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
  }, min);
  expect(small, 'buttons smaller than the child minimum').toEqual([]);
}

/** Every visible button lies inside the viewport (nothing critical cropped). */
export async function expectButtonsInViewport(page: Page) {
  const out = await page.evaluate(() => {
    const W = innerWidth;
    const H = innerHeight;
    return [...document.querySelectorAll('main button')]
      .filter((b) => {
        const s = getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return r.width > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
      })
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1;
      })
      .map((b) => b.getAttribute('aria-label') ?? b.getAttribute('data-testid') ?? '?');
  });
  expect(out, 'buttons outside the viewport').toEqual([]);
}

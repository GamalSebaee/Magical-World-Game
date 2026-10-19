import { expect, test } from '@playwright/test';
import {
  activity,
  audioHistory,
  expectButtonsInViewport,
  expectLargeButtons,
  expectObjectsInViewport,
  guardPage,
  playA1A2,
  sceneObjects,
  setupChild,
  startAf01,
  tapObject,
  waitForPhase,
} from './helpers';

/** The AF-01 vertical slice (10 §P2), microphone off unless a test turns it on. */
test.describe('AF-01 vertical slice', () => {
  test('a full playthrough earns the sticker once; replaying never grants it twice (G2, G8)', async ({ page }) => {
    test.setTimeout(120_000);
    const guard = guardPage(page);
    await setupChild(page);
    await startAf01(page);
    await expectLargeButtons(page);
    await expectButtonsInViewport(page);
    expect(await audioHistory(page)).toContain('/assets/audio/ar/af01.a1.instruction.mp3');
    await playA1A2(page);

    // Speaking with the microphone off: "say it with Nono", which records nothing.
    await expect(page.getByTestId('mic-note')).toBeVisible();
    await page.getByTestId('speech-together').click();
    await expect(page.getByTestId('speech-continue')).toBeVisible({ timeout: 10_000 });
    await waitForPhase(page, 'ready', 'af01.a3');
    await page.getByTestId('speech-continue').click();

    await page.waitForURL('**/level/af-01/result/');
    await expect(page.getByTestId('result-sticker-state')).toHaveAttribute('data-new', 'true');
    const counts = await page.evaluate(() => window.__MWG__.storageCounts());
    expect(counts.stickers).toBe(1);
    expect(counts.attempts).toBe(3);

    // Refreshing the result grants nothing and shows the "you have it" variant.
    await page.reload();
    await expect(page.getByTestId('result-sticker-state')).toHaveAttribute('data-new', 'false', { timeout: 15_000 });
    expect((await page.evaluate(() => window.__MWG__.storageCounts())).stickers).toBe(1);

    // Replay by skipping everything: same celebration, still one sticker.
    await page.getByTestId('result-replay').click();
    await page.getByTestId('intro-start').click();
    for (const id of ['af01.a1', 'af01.a2', 'af01.a3']) {
      await waitForPhase(page, 'ready', id);
      await page.getByTestId('hud-skip').click();
    }
    await page.waitForURL('**/level/af-01/result/');
    await expect(page.getByTestId('result-sticker-state')).toHaveAttribute('data-new', 'false');
    expect((await page.evaluate(() => window.__MWG__.storageCounts())).stickers).toBe(1);

    // The sticker book shows it.
    await page.getByTestId('result-map').click();
    await page.getByTestId('open-stickers').click();
    await expect(page.getByTestId('sticker-af-01')).toHaveAttribute('data-earned', 'true');
    guard.assertClean();
  });

  test('rapid repeated taps reveal once (T-MECH-02)', async ({ page }) => {
    await setupChild(page);
    await startAf01(page);
    for (let i = 0; i < 6; i++) await tapObject(page, 'cat');
    await waitForPhase(page, 'ready', 'af01.a1');
    expect((await activity(page))!.m).toEqual({ found: ['cat'] });
  });

  test('rotating mid-activity keeps state and re-lays out inside the viewport (G7, T-ORI-03)', async ({ page }) => {
    await setupChild(page);
    await startAf01(page);
    await tapObject(page, 'cat');
    await waitForPhase(page, 'ready', 'af01.a1');
    const before = (await audioHistory(page)).length;
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expect.poll(async () => (await page.evaluate(() => window.__MWG__.phaser().viewport))?.width).toBe(height);
    await page.waitForTimeout(300);
    expect((await activity(page))!.m).toEqual({ found: ['cat'] });
    expect((await sceneObjects(page)).find((o) => o.id === 'cat')!.state).toBe('found');
    await expectObjectsInViewport(page);
    await expectButtonsInViewport(page);
    // Rotation does not replay the instruction.
    expect((await audioHistory(page)).length).toBe(before);
    await tapObject(page, 'dog');
    await waitForPhase(page, 'ready', 'af01.a2');
  });

  test('refreshing mid-level offers Continue and resumes at the same step (T-PER-05)', async ({ page }) => {
    await setupChild(page);
    await startAf01(page);
    await tapObject(page, 'cat');
    await waitForPhase(page, 'ready', 'af01.a1');
    await page.goto('/level/af-01/');
    await page.getByTestId('intro-continue').click();
    await waitForPhase(page, 'ready', 'af01.a1');
    expect((await activity(page))!.m).toEqual({ found: ['cat'] });
    // "Start over" from the intro discards the snapshot.
    await page.goto('/level/af-01/');
    await page.getByTestId('intro-restart').click();
    await waitForPhase(page, 'ready', 'af01.a1');
    expect((await activity(page))!.m).toEqual({ found: [] });
  });

  test('backgrounding pauses; the pause menu resumes, restarts or leaves (C12)', async ({ page }) => {
    await setupChild(page);
    await startAf01(page);
    await tapObject(page, 'cat');
    await waitForPhase(page, 'ready', 'af01.a1');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    });
    await expect(page.getByTestId('pause-menu')).toBeVisible();
    expect((await activity(page))!.paused).toBe(true);
    // The overlay blocks the game: a tap on its backdrop changes nothing.
    const vp = page.viewportSize()!;
    await page.mouse.click(4, vp.height - 4);
    await expect(page.getByTestId('pause-menu')).toBeVisible();
    expect((await activity(page))!.m).toEqual({ found: ['cat'] });
    await page.getByTestId('pause-resume').click();
    await expect(page.getByTestId('pause-menu')).toHaveCount(0);
    await expect.poll(async () => (await activity(page))!.paused).toBe(false);

    // Browser back opens the pause menu instead of leaving.
    await page.goBack();
    await expect(page.getByTestId('pause-menu')).toBeVisible();
    expect(page.url()).toContain('/play/');
    await page.getByTestId('pause-restart').click();
    await waitForPhase(page, 'ready', 'af01.a1');
    expect((await activity(page))!.m).toEqual({ found: [] });
    await page.getByTestId('hud-pause').click();
    await page.getByTestId('pause-map').click();
    await page.waitForURL('**/map/');
  });

  test('help steps through hint levels to the demonstrating hand (C13)', async ({ page }) => {
    await setupChild(page);
    await startAf01(page);
    for (let i = 1; i <= 3; i++) {
      await page.getByTestId('hud-help').click();
      await expect.poll(async () => (await activity(page))!.hintLevel).toBe(i);
    }
    expect((await activity(page)) as { demo?: boolean }).toMatchObject({ demo: true });
  });

  test('English mode plays English clips in an LTR layout (G4)', async ({ page }) => {
    await setupChild(page, { language: 'en' });
    await startAf01(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await tapObject(page, 'cat');
    await waitForPhase(page, 'ready', 'af01.a1');
    const h = await audioHistory(page);
    expect(h).toContain('/assets/audio/en/af01.a1.instruction.mp3');
    expect(h).toContain('/assets/audio/en/word.animals.cat.mp3');
    expect(h.some((u) => u.includes('/ar/'))).toBe(false);
  });

  test('mixed mode says the Arabic word then the English word (G4)', async ({ page }) => {
    await setupChild(page, { language: 'mixed' });
    await startAf01(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await tapObject(page, 'cat');
    await waitForPhase(page, 'ready', 'af01.a1');
    const h = await audioHistory(page);
    const i = h.indexOf('/assets/audio/ar/word.animals.cat.mp3');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(h[i + 1]).toBe('/assets/audio/en/word.animals.cat.mp3');
  });

  test('every child screen in the journey keeps buttons large and on screen', async ({ page }) => {
    await setupChild(page);
    for (const path of ['/profiles/', '/avatar/', '/welcome/', '/map/', '/world/animal-forest/', '/level/af-01/', '/stickers/']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
      await expectLargeButtons(page);
      await expectButtonsInViewport(page);
    }
  });
});

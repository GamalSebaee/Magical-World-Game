import { expect, test, type Page } from '@playwright/test';
import { activity, expectButtonsInViewport, guardPage, sceneObjects, setupChild, tapObject, waitForObjects } from './helpers';

/**
 * Phase 4: every level is reachable from the map and can be played to its sticker in the real app,
 * following the hint target the way a child following Nono's hints would (taps; drags as
 * tap-then-tap). Speaking uses "say it with Nono" (microphone off).
 */
const WORLDS: Record<string, string[]> = {
  'animal-forest': ['af-01', 'af-02', 'af-03', 'af-04'],
  'color-town': ['ct-01', 'ct-02', 'ct-03', 'ct-04'],
  'number-island': ['ni-01', 'ni-02', 'ni-03', 'ni-04'],
};

async function playLevel(page: Page, levelId: string) {
  const done = new Set<string>();
  for (let step = 0; step < 120; step++) {
    if (page.url().includes('/result/')) return;
    const a = await activity(page);
    if (!a || a.phase !== 'ready') {
      await page.waitForTimeout(150);
      continue;
    }
    if (a.mechanic === 'speak_repeat') {
      if (!done.has(a.activityId)) {
        await page.getByTestId('speech-together').click();
        done.add(a.activityId);
      }
      const cont = page.getByTestId('speech-continue');
      if (await cont.isVisible()) await cont.click();
      else await page.waitForTimeout(200);
      continue;
    }
    expect(a.hintTarget, `${a.activityId} has a hint target`).toBeTruthy();
    const before = JSON.stringify([a.phase, a.m, a.last?.seq]);
    await tapObject(page, a.hintTarget!);
    await page.waitForFunction((b) => {
      const s = window.__MWG__.activity();
      return !s || JSON.stringify([s.phase, s.m, s.last?.seq]) !== b;
    }, before, { timeout: 10_000 });
  }
  throw new Error(`${levelId}: did not reach the result`);
}

test.describe('Phase 4 levels', () => {
  test('the map has three worlds and each world overview lists its 4 levels', async ({ page }) => {
    const guard = guardPage(page);
    await setupChild(page);
    await waitForObjects(page, 3);
    expect((await sceneObjects(page)).map((o) => o.id).sort()).toEqual(Object.keys(WORLDS).sort());
    for (const [world, levels] of Object.entries(WORLDS)) {
      await page.goto(`/world/${world}/`);
      for (const l of levels) await expect(page.getByTestId(`level-${l}`)).toBeVisible();
      await expectButtonsInViewport(page);
    }
    // The sticker book has one page per world, turned with the arrows.
    await page.goto('/stickers/');
    await expect(page.getByTestId('stickers-page-animal-forest')).toBeVisible();
    await expectButtonsInViewport(page);
    await page.getByTestId('stickers-next').click();
    await expect(page.getByTestId('stickers-page-color-town')).toBeVisible();
    await page.waitForTimeout(450); // child buttons ignore repeat taps within 400 ms
    await page.getByTestId('stickers-next').click();
    await expect(page.getByTestId('stickers-page-number-island')).toBeVisible();
    await expect(page.getByTestId('stickers-next')).toBeHidden();
    await expectButtonsInViewport(page);
    await page.waitForTimeout(450);
    await page.getByTestId('stickers-prev').click();
    await expect(page.getByTestId('stickers-page-color-town')).toBeVisible();
    guard.assertClean();
  });

  for (const [world, levels] of Object.entries(WORLDS)) {
    for (const levelId of levels) {
      test(`${levelId} plays from the map to its sticker`, async ({ page }) => {
        test.setTimeout(180_000);
        const guard = guardPage(page);
        await setupChild(page);
        await waitForObjects(page, 3);
        await tapObject(page, world);
        await page.waitForURL(`**/world/${world}/`);
        await page.getByTestId(`level-${levelId}`).click();
        await page.waitForURL(`**/level/${levelId}/`);
        await page.getByTestId('intro-start').click();
        await page.waitForURL(`**/level/${levelId}/play/**`);
        await playLevel(page, levelId);
        await page.waitForURL(`**/level/${levelId}/result/`);
        await expect(page.getByTestId('result-sticker-state')).toHaveAttribute('data-new', 'true');
        const counts = await page.evaluate(() => window.__MWG__.storageCounts());
        expect(counts.stickers).toBe(1);
        guard.assertClean();
      });
    }
  }
});

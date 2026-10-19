import { expect, test, type Page } from '@playwright/test';
import { guardPage, openMap } from './helpers';

const objects = (page: Page) => page.evaluate(() => window.__MWG__.sceneObjects());

async function expectInsideViewport(page: Page) {
  const vp = page.viewportSize()!;
  for (const o of await objects(page)) {
    expect(o.rect.x, o.id).toBeGreaterThanOrEqual(-0.5);
    expect(o.rect.y, o.id).toBeGreaterThanOrEqual(-0.5);
    expect(o.rect.x + o.rect.width, o.id).toBeLessThanOrEqual(vp.width + 0.5);
    expect(o.rect.y + o.rect.height, o.id).toBeLessThanOrEqual(vp.height + 0.5);
    expect(o.rect.width, o.id).toBeGreaterThanOrEqual(64);
  }
}

async function tapObject(page: Page, index: number) {
  const o = (await objects(page))[index]!;
  const x = o.rect.x + o.rect.width / 2;
  const y = o.rect.y + o.rect.height / 2;
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test.describe('Phaser host lifecycle (02 §4)', () => {
  test('mounts a canvas and lays out targets inside the viewport', async ({ page }) => {
    const guard = guardPage(page);
    await openMap(page);
    await expect(page.locator('[data-testid="game-host"] canvas')).toHaveCount(1);
    await expectInsideViewport(page);
    guard.assertClean();
  });

  test('rotation keeps scene state and re-lays out (T-ORI)', async ({ page }) => {
    await openMap(page);
    await tapObject(page, 1);
    await expect.poll(async () => (await objects(page))[1]!.state).toBe('tapped');

    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expect.poll(async () => (await page.evaluate(() => window.__MWG__.phaser().viewport))?.width).toBe(height);

    const after = await objects(page);
    expect(after.map((o) => o.state)).toEqual(['idle', 'tapped', 'idle']);
    await expectInsideViewport(page);
  });

  test('20 route round-trips reuse one game and never leak canvases', async ({ page }) => {
    test.setTimeout(120_000);
    const guard = guardPage(page);
    await openMap(page);
    for (let i = 0; i < 20; i++) {
      await page.getByTestId('home').click();
      await expect(page.getByTestId('play')).toBeVisible();
      await page.getByTestId('play').click();
      await page.waitForURL('**/map/');
      await page.waitForFunction(() => window.__MWG__.sceneObjects().length === 3);
    }
    const stats = await page.evaluate(() => window.__MWG__.phaser());
    expect(stats.gamesCreated).toBe(1);
    expect(stats.canvasesInDocument).toBe(1);
    expect(stats.attachCount - stats.detachCount).toBe(1);
    await page.getByTestId('home').click();
    await expect(page.getByTestId('play')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__MWG__.phaser().sleeping)).toBe(true);
    guard.assertClean();
  });
});

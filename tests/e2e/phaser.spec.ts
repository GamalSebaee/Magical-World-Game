import { expect, test } from '@playwright/test';
import { expectObjectsInViewport, guardPage, setupChild, sceneObjects, waitForObjects } from './helpers';

test.describe('Phaser host lifecycle (02 §4) on the world map', () => {
  test('map shows only playable worlds, inside the viewport, with large hotspots', async ({ page }) => {
    const guard = guardPage(page);
    await setupChild(page);
    await expect(page.locator('[data-testid="game-host"] canvas')).toHaveCount(1);
    expect((await sceneObjects(page)).map((o) => o.id)).toEqual(['animal-forest']);
    await expectObjectsInViewport(page);
    guard.assertClean();
  });

  test('rotation re-lays out the map (T-ORI)', async ({ page }) => {
    await setupChild(page);
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expect.poll(async () => (await page.evaluate(() => window.__MWG__.phaser().viewport))?.width).toBe(height);
    await expectObjectsInViewport(page);
  });

  test('a drag starting on a world does not enter it (03 C5)', async ({ page }) => {
    await setupChild(page);
    const o = (await sceneObjects(page))[0]!;
    const x = o.rect.x + o.rect.width / 2;
    const y = o.rect.y + o.rect.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 10, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/map/');
  });

  test('20 route round-trips reuse one game and never leak canvases', async ({ page }) => {
    test.setTimeout(120_000);
    const guard = guardPage(page);
    await setupChild(page);
    for (let i = 0; i < 20; i++) {
      await page.getByTestId('open-stickers').click();
      await page.waitForURL('**/stickers/');
      await page.getByTestId('back').click();
      await page.waitForURL('**/map/');
      await waitForObjects(page, 1);
    }
    const stats = await page.evaluate(() => window.__MWG__.phaser());
    expect(stats.gamesCreated).toBe(1);
    expect(stats.canvasesInDocument).toBe(1);
    expect(stats.attachCount - stats.detachCount).toBe(1);
    guard.assertClean();
  });
});

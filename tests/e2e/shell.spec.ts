import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { bootToPlay, guardPage, setupChild } from './helpers';

test.describe('app shell (C1 splash, P1 gate, first run)', () => {
  test('boots to a Play button, in Arabic RTL by default', async ({ page }) => {
    const guard = guardPage(page);
    await bootToPlay(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar-EG');
    await expect(page.getByRole('button', { name: 'يلا نلعب' })).toBeVisible();
    guard.assertClean();
  });

  test('first run goes to grown-up setup; English choice switches direction and persists (IndexedDB)', async ({ page }) => {
    const guard = guardPage(page);
    await setupChild(page, { language: 'en' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    expect(await page.evaluate(() => window.__MWG__.storageStatus())).toEqual({ backend: 'indexeddb' });
    await page.reload();
    await page.waitForFunction(() => window.__MWG__?.sceneObjects().length >= 1, null, { timeout: 15_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    guard.assertClean();
  });

  test('Play is a large target inside the viewport', async ({ page }) => {
    await bootToPlay(page);
    const box = await page.getByTestId('play').boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(88);
    expect(box!.height).toBeGreaterThanOrEqual(88);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
  });

  test('splash and setup have no serious accessibility violations (T-A11Y)', async ({ page }) => {
    await bootToPlay(page);
    const splash = await new AxeBuilder({ page }).analyze();
    expect(splash.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id)).toEqual([]);
    await page.getByTestId('play').click();
    await page.waitForURL('**/parent/setup/');
    const setup = await new AxeBuilder({ page }).analyze();
    expect(setup.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id)).toEqual([]);
  });

  test('the parent gate needs a hold and the written instruction; random taps do not open it', async ({ page }) => {
    await setupChild(page);
    await page.getByTestId('back').click(); // home → profiles
    await page.waitForURL('**/profiles/');
    await page.getByTestId('grown-ups').click();
    await page.waitForURL('**/parent/');
    // A quick tap is not a hold.
    await page.getByTestId('gate-hold').click();
    await expect(page.getByTestId('gate-instruction')).toHaveCount(0);
    // Hold for 2 s.
    const hold = await page.getByTestId('gate-hold').boundingBox();
    await page.mouse.move(hold!.x + 20, hold!.y + 20);
    await page.mouse.down();
    await page.waitForTimeout(2300);
    await page.mouse.up();
    const text = await page.getByTestId('gate-instruction').textContent();
    // "اضغط على X، ثم على Y." → tap the named tiles.
    const [, a, b] = /اضغط على (.+)، ثم على (.+)\./.exec(text!)!;
    await page.getByRole('button', { name: a!, exact: true }).click();
    await page.getByRole('button', { name: b!, exact: true }).click();
    await expect(page.getByTestId('parent-area')).toBeVisible();
    await page.getByTestId('back-to-child').click();
    await page.waitForURL('**/profiles/');
  });

  test('unknown URLs lead home, not to a dead end', async ({ page }) => {
    await page.goto('/no-such-place/');
    await page.getByRole('link').first().click();
    await expect(page.getByTestId('play')).toBeVisible({ timeout: 15_000 });
  });
});

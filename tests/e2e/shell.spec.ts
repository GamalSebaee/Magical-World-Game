import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { bootToPlay, guardPage } from './helpers';

test.describe('app shell (C1 splash, P1 foundation)', () => {
  test('boots to a Play button, in Arabic RTL by default', async ({ page }) => {
    const guard = guardPage(page);
    await bootToPlay(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar-EG');
    await expect(page.getByRole('button', { name: 'يلا نلعب' })).toBeVisible();
    guard.assertClean();
  });

  test('switching language changes direction and survives a reload (IndexedDB)', async ({ page }) => {
    const guard = guardPage(page);
    await bootToPlay(page);
    expect(await page.evaluate(() => window.__MWG__.storageStatus())).toEqual({ backend: 'indexeddb' });
    await page.getByTestId('lang-en').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByTestId('lang-mixed').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    guard.assertClean();
  });

  test('Play is a large target inside the viewport', async ({ page }) => {
    await bootToPlay(page);
    const box = await page.getByTestId('play').boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(88);
    expect(box!.height).toBeGreaterThanOrEqual(88);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
  });

  test('has no serious accessibility violations (T-A11Y)', async ({ page }) => {
    await bootToPlay(page);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('unknown URLs lead home, not to a dead end', async ({ page }) => {
    await page.goto('/no-such-place/');
    await page.getByRole('link').first().click();
    await expect(page.getByTestId('play')).toBeVisible({ timeout: 15_000 });
  });
});

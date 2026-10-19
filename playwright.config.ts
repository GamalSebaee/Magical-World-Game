import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * E2E runs against the real static export (with test hooks compiled in), served over HTTP on
 * localhost — a secure context, so service workers work. See 09 §1 and §5.
 * Locally: `pnpm test:e2e --project=chromium-portrait --project=chromium-landscape`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'ar-EG',
  },
  projects: [
    { name: 'chromium-portrait', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'chromium-landscape', use: { ...devices['Pixel 7 landscape'], viewport: { width: 844, height: 390 } } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `NEXT_PUBLIC_TEST_HOOKS=1 pnpm build && npx serve out -l ${PORT} --no-clipboard`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});

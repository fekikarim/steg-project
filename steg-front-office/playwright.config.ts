import { defineConfig, devices } from '@playwright/test';

/**
 * Front Office E2E — Playwright configuration (Phase E9).
 *
 * Targets: register → login → apply → track
 *
 * The suite uses a stateful mock API (see e2e/mock-api.ts) that intercepts
 * fetch calls via route interception. Hermetic and deterministic.
 *
 * For live-backend smoke tests, set STEG_BACKEND_URL env var and pass
 * --project=live-smoke.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // sequential to mirror real user flow order
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'fr',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

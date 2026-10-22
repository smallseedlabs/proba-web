import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, no Hub or Firebase project required:
 * - "chromium": a build with the development-only demo data (VITE_DEMO_MODE=true).
 * - "firebase": the production build with the real Firebase JS SDK; Firebase
 *   Authentication and proba-hub are mocked at the network level (e2e/firebase/mock.ts).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /firebase\//,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firebase',
      testMatch: /firebase\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://localhost:4180' },
    },
  ],
  webServer: [
    {
      command: 'npm run build:demo && npm run preview:demo',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build:e2e && npm run preview:e2e',
      url: 'http://localhost:4180',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

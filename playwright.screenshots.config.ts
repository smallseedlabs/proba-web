import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/** Captures the product screenshots in docs/screenshots (npm run screenshots). */
export default defineConfig({
  ...base,
  testDir: './e2e-screenshots',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  projects: [
    {
      name: 'screenshots',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
  ],
});

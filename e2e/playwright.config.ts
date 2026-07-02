import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:4200';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000/api/v1';

export default defineConfig({
  globalSetup: './global-setup.ts',
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: process.env.CI === 'true',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: [
    {
      command: 'npm run start:dev',
      cwd: '../backend',
      url: 'http://127.0.0.1:3000/docs',
      // Always reuse an already-running backend rather than !process.env.CI.
      // In CI the workflow starts the backend itself (after running migrations,
      // which this webServer command doesn't do) — Playwright must not try to
      // start a competing second instance on the same port.
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npx ng serve --port 4200',
      cwd: '../frontend',
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

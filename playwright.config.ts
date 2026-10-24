import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3101', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/test-server.mjs', url: 'http://127.0.0.1:3101/api/health', reuseExistingServer: false },
});

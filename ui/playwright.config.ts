import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

// End-to-end smoke test: the real API (clean, seeded SQLite file) and the real UI, no mock.
// Run with `npm run e2e` from ui/. See ui/README.md ("End-to-end test").
const uiUrl = 'http://localhost:4200';
const apiUrl = 'http://localhost:5204';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: uiUrl,
    viewport: { width: 1280, height: 900 },
    // Set E2E_BROWSER_CHANNEL=msedge (or chrome) to use an installed browser instead of Playwright's Chromium.
    channel: process.env['E2E_BROWSER_CHANNEL'] || undefined,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // A throwaway database so the test never touches api/starbase.db; Development seeds it on startup.
      command: 'dotnet run --project ../api --no-launch-profile',
      url: `${apiUrl}/Person`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ASPNETCORE_URLS: apiUrl,
        ConnectionStrings__StarbaseApiDatabase: `Data Source=${join(tmpdir(), `acts-e2e-${Date.now()}.db`)}`,
      },
    },
    {
      command: 'npm run start',
      url: uiUrl,
      timeout: 180_000,
      reuseExistingServer: true,
    },
  ],
});

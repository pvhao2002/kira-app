import { defineConfig, devices } from '@playwright/test';

// E2E runs against a real stack, by default the throw-away one of docker-compose.e2e.yml. Nothing is mocked.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1, // journeys share one database and build on each other's data
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8188', // the e2e stack (npm run e2e:stack)
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
});

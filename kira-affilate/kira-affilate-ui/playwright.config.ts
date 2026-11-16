import {defineConfig} from '@playwright/test';

// `app.spec.ts` needs the real backend on :8082 (it skips itself otherwise); `mocked.spec.ts` stubs /api and needs only the UI.
export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  use: {baseURL: 'http://localhost:4202', trace: 'retain-on-failure'},
  projects: [
    {name: 'desktop-1440', use: {viewport: {width: 1440, height: 900}}},
    {name: 'tablet-768', use: {viewport: {width: 768, height: 1024}}},
    {name: 'mobile-390', use: {viewport: {width: 390, height: 844}}}
  ],
  webServer: {command: 'npm start', url: 'http://localhost:4202', reuseExistingServer: true, timeout: 120_000}
});

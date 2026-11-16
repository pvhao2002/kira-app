import {expect, Page, test} from '@playwright/test';
import {expectNoHorizontalOverflow, navTo, PAGES} from './pages';

// Real-backend flow. One account per viewport project keeps registrations low (the API rate-limits auth).
test.describe.configure({mode: 'serial'});

let page: Page;

test.beforeAll(async ({browser, request}, testInfo) => {
  const health = await request.get('http://localhost:8082/actuator/health').catch(() => null);
  test.skip(!health?.ok(), 'kira-affilate-service is not running on :8082');

  page = await browser.newPage();
  const email = `e2e-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByTestId('auth-name').fill('Người Dùng E2E');
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill('E2e-password-123');
  await page.getByTestId('auth-submit').click();
});

test.afterAll(async () => {
  await page?.close();
});

test('register lands on the dashboard empty state', async () => {
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole('heading', {level: 1, name: 'Tổng quan'})).toBeVisible();
  await expect(page.getByTestId('dashboard-not-connected')).toBeVisible();
  await expect(page.getByTestId('dashboard-stats')).toHaveCount(0);
});

test('settings shows Shopee as not connected', async () => {
  await navTo(page, 'settings');
  await expect(page.getByTestId('shopee-status')).toContainText(/chưa kết nối/i);
});

test('link converter rejects a non-Shopee URL before calling the server', async () => {
  await navTo(page, 'convert');
  let converted = false;
  await page.route('**/api/v1/links/convert', route => {
    converted = true;
    return route.continue();
  });
  await page.getByTestId('convert-urls').fill('https://lazada.vn/san-pham-1');
  await page.getByTestId('convert-submit').click();
  await expect(page.getByTestId('convert-errors')).toContainText('Dòng 1');
  expect(converted).toBe(false);
});

test('all 10 pages render their heading without horizontal overflow', async () => {
  for (const [path, heading] of PAGES) {
    await navTo(page, path);
    await expect(page.getByRole('heading', {level: 1, name: heading})).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('the session survives a reload through the refresh cookie', async () => {
  await page.reload();
  await expect(page.getByRole('heading', {level: 1, name: 'Cài đặt'})).toBeVisible();
});

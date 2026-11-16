import {expect, Page, Route, test} from '@playwright/test';
import {expectNoHorizontalOverflow, navTo, PAGES} from './pages';

// UI-only checks against a stubbed /api shaped like docs/api.md. Fixture values are test data, not product copy;
// deliberately long names prove tables and cards do not widen the page.

const LONG = 'Áo khoác gió nam nữ chống nắng chống nước siêu nhẹ có mũ tháo rời phong cách Hàn Quốc phiên bản giới hạn 2026';
const page0 = <T>(data: T[]) => ({data, meta: {page: 0, size: 20, totalElements: data.length, totalPages: 1}});
const order = (id: number, bucket: string, orderStatus: string) => ({
  id, conversionId: `90000${id}`, orderId: `2611ABCDEF${id}`, itemId: `77${id}`, itemName: `${LONG} #${id}`, shopName: 'Shop Thời Trang Chính Hãng Việt Nam',
  imageUrl: null, qty: 2, itemPrice: 259000, actualAmount: 518000, refundAmount: 0, orderStatus, fraudStatus: 'VERIFIED', bucket, commission: 25900,
  purchaseTime: '2026-11-16T18:30:00Z', completeTime: null, utmContent: 'fb01-video02-zalo03-tiktok04-insta05'
});
const ORDERS = [order(1, 'ESTIMATED', 'PENDING'), order(2, 'CONFIRMED', 'COMPLETED'), order(3, 'REJECTED', 'CANCELLED'), order(4, 'VALIDATED', 'COMPLETED')];
const RUN = {id: 1, kind: 'CONVERSIONS', trigger: 'MANUAL', status: 'SUCCESS', startedAt: '2026-11-16T10:00:00Z', finishedAt: '2026-11-16T10:00:09Z', rowsUpserted: 4, errorCode: null, errorMessage: null};
const TOP = [{key: 'a', label: LONG, orders: 3, items: 5, gmv: 1554000, commission: 77700}, {key: 'b', label: 'fb01', orders: 1, items: 1, gmv: 259000, commission: 12950}];

const ROUTES: [pattern: RegExp, body: unknown][] = [
  [/\/auth\/refresh$/, {accessToken: 'test-token', expiresInSeconds: 900, user: {id: 1, email: 'e2e@example.com', fullName: 'Người Dùng E2E', version: 0}}],
  [/\/shopee\/credentials$/, {configured: true, appId: '18300000001', lastCheckedAt: '2026-11-16T10:00:00Z', lastStatus: 'NO_API_ACCESS', lastErrorCode: '10035', lastErrorMessage: 'no access'}],
  [/\/shopee\/offers\/products/, {page: 1, limit: 20, hasNextPage: true, items: [1, 2, 3].map(i => ({
    itemId: i, productName: `${LONG} #${i}`, imageUrl: null, priceMin: 199000, priceMax: 259000, sales: 1200, ratingStar: '4.8',
    commissionRate: '0.125', commission: 32375, shopName: 'Shop Thời Trang Chính Hãng Việt Nam', productLink: `https://shopee.vn/product/1/${i}`, offerLink: null}))}],
  [/\/shopee\/offers\/(shops|campaigns)/, {page: 1, limit: 20, hasNextPage: false, items: []}],
  [/\/campaigns$/, [{id: 1, name: 'Chiến dịch Tết', subIds: ['fb01', 'video02'], createdAt: '2026-11-01T03:00:00Z'}]],
  [/\/links\?/, page0([{id: 1, originUrl: `https://shopee.vn/${'san-pham-rat-dai-'.repeat(8)}i.1.2`, shortLink: 'https://s.shopee.vn/AbCdEf', subIds: ['fb01', 'video02'],
    campaignId: 1, campaignName: 'Chiến dịch Tết', status: 'OK', error: null, createdAt: '2026-11-16T18:30:00Z'}])],
  [/\/orders\/\d+$/, {...ORDERS[0], modelId: '5', clickTime: '2026-11-16T18:00:00Z', buyerType: 'NEW', device: 'APP', referrer: 'facebook.com', itemSellerCommission: 20000,
    itemShopeeCommission: 5900, conversionTotalCommission: 25900, conversionNetCommission: 25900, validatedAt: null, validationId: null, categoryLv1: 'Thời Trang Nam', itemNotes: null}],
  [/\/orders\?/, page0(ORDERS)],
  [/\/sync\/status$/, {running: false, lastRun: RUN, lastSuccessAt: RUN.finishedAt}],
  [/\/sync\/runs/, page0([RUN])],
  [/\/validations$/, [{validationId: 12345, importedAt: '2026-11-10T03:00:00Z', conversions: 1, totalCommission: 25900}]],
  [/\/reports\/summary/, {orders: 4, items: 8, gmv: 2072000, commission: {estimated: 25900, confirmed: 25900, rejected: 25900, validated: 25900}, links: 1, clicksAvailable: false}],
  [/\/reports\/timeseries/, [{period: '2026-11-15', orders: 1, gmv: 518000, estimated: 0, confirmed: 25900, rejected: 0}, {period: '2026-11-16', orders: 3, gmv: 1554000, estimated: 25900, confirmed: 0, rejected: 25900}]],
  [/\/reports\/top/, TOP]
];

const fulfill = (route: Route) => {
  const url = route.request().url();
  const match = ROUTES.find(([pattern]) => pattern.test(url));
  return match ? route.fulfill({json: match[1]}) : route.fulfill({status: 404, json: {code: 'NOT_FOUND', message: 'Không tìm thấy'}});
};

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/api/v1/**', fulfill);
  await page.goto('/app/dashboard');
  return errors;
}

test('all 10 pages render with data, without horizontal overflow or console errors', async ({page}) => {
  const errors = await open(page);
  for (const [path, heading] of PAGES) {
    await navTo(page, path);
    await expect(page.getByRole('heading', {level: 1, name: heading})).toBeVisible();
    await expect(page.getByTestId('state-loading')).toHaveCount(0);
    await expect(page.getByTestId('state-error')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('dashboard shows figures from the API and never a click count', async ({page}) => {
  await open(page);
  await expect(page.getByTestId('stat-gmv')).toContainText('2.072.000');
  await expect(page.getByTestId('stat-clicks')).toContainText('Shopee Open API không cung cấp số lượt nhấp');
  await expect(page.getByTestId('stat-conversion')).toContainText('Shopee Open API không cung cấp số lượt nhấp');
  await expect(page.getByTestId('trend-chart')).toBeVisible();
  await expect(page.getByTestId('dashboard-recent-orders').locator('tbody tr')).toHaveCount(4);
  await expect(page.getByTestId('nav-dashboard')).toHaveAttribute('aria-current', 'page');
});

test('order row opens the detail drawer in Vietnam time and Escape closes it', async ({page}) => {
  await open(page);
  await navTo(page, 'orders');
  await page.getByTestId('order-open').first().click();
  const drawer = page.getByTestId('order-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('Thời Trang Nam');
  await expect(drawer).toContainText('17/11/2026 01:30');
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('converter validates locally, then lists server results per row', async ({page}) => {
  await open(page);
  await navTo(page, 'convert');
  await page.getByTestId('convert-urls').fill('https://shopee.vn/a\nhttps://lazada.vn/b');
  await page.getByTestId('convert-submit').click();
  await expect(page.getByTestId('convert-errors')).toContainText('Dòng 2');

  await page.route('**/api/v1/links/convert', route => route.fulfill({json: {results: [
    {originUrl: 'https://shopee.vn/a', status: 'OK', shortLink: 'https://s.shopee.vn/AbCdEf', error: null, id: 1},
    {originUrl: 'https://shopee.vn/b', status: 'FAILED', shortLink: null, error: 'Shopee từ chối liên kết này', id: null}]}}));
  await page.getByTestId('convert-urls').fill('https://shopee.vn/a\nhttps://shopee.vn/b');
  await page.getByTestId('convert-sub-0').fill('fb-01');
  await page.getByTestId('convert-submit').click();
  await expect(page.getByTestId('convert-errors')).toContainText('Sub ID');
  await page.getByTestId('convert-sub-0').fill('fb01');
  await page.getByTestId('convert-submit').click();
  const rows = page.getByTestId('convert-results').locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('https://s.shopee.vn/AbCdEf');
  await expect(rows.nth(1)).toContainText('Shopee từ chối liên kết này');
});

test('settings explains NO_API_ACCESS and never shows a stored secret', async ({page}) => {
  await open(page);
  await navTo(page, 'settings');
  const detail = page.getByTestId('shopee-status-detail');
  await expect(detail).toContainText('Tài khoản chưa được Shopee cấp quyền Open API');
  await expect(detail.getByRole('link')).toHaveAttribute('href', 'https://affiliate.shopee.vn/open_api');
  await expect(detail.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByTestId('shopee-secret')).toHaveValue('');
});

test('tax calculator estimates from cited rules and flags them as unverified', async ({page}) => {
  await open(page);
  await navTo(page, 'tax');
  await page.getByTestId('tax-income').fill('300000000');
  await page.getByTestId('tax-submit').click();
  await expect(page.getByRole('alert')).toContainText('chọn đối tượng');
  await page.getByTestId('tax-year').selectOption({label: '2025'});
  await page.getByTestId('tax-class').selectOption('salary');
  await page.getByTestId('tax-dependents').fill('1');
  await page.getByTestId('tax-submit').click();
  // 300m - 132m - 52.8m = 115.2m taxable -> 60m*5% + 55.2m*10%
  await expect(page.getByTestId('tax-due')).toContainText('8.520.000');
  await expect(page.getByTestId('tax-result')).toContainText('chưa đối chiếu văn bản gốc');
});

test('knowledge pages list cited entries, search without diacritics and flag unverified ones', async ({page}) => {
  await open(page);
  await navTo(page, 'legal');
  await expect(page.getByText('Chưa đối chiếu văn bản gốc').first()).toBeVisible();
  await expect(page.getByText('Số 75/2025/QH15').first()).toBeVisible();
  await expect(page.getByRole('link', {name: /Luật sửa đổi, bổ sung một số điều của Luật Quảng cáo/}).first()).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByTestId('kc-search').fill('du lieu ca nhan');
  await expect(page.getByText('Thu thập và sử dụng dữ liệu cá nhân')).toBeVisible();
  await expect(page.getByText('Quảng cáo gian dối')).toHaveCount(0);
  await navTo(page, 'guides');
  await expect(page.getByText('Những việc không được làm')).toBeVisible();
});

test('a failing API shows the error state with retry instead of zeros', async ({page}) => {
  await open(page);
  await page.route('**/api/v1/reports/summary**', route => route.fulfill({status: 502, json: {code: 'SHOPEE_UNAVAILABLE', message: 'Shopee đang gián đoạn'}}));
  await page.reload();
  await expect(page.getByTestId('state-error').first()).toContainText('Shopee đang gián đoạn');
  await expect(page.getByTestId('dashboard-stats')).toHaveCount(0);
});

test('login validates before calling the server and shows the server error', async ({page}) => {
  await page.route('**/api/v1/auth/login', route => route.fulfill({status: 401, json: {code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng'}}));
  await page.goto('/login');
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('auth-email-error')).toBeVisible();
  await page.getByTestId('auth-email').fill('e2e@example.com');
  await page.getByTestId('auth-password').fill('wrong-password');
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('auth-server-error')).toHaveText('Email hoặc mật khẩu không đúng');
  await expectNoHorizontalOverflow(page);
});

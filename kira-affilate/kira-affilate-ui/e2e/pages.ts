import {expect, Page} from '@playwright/test';

/** Sidebar order and exact labels. */
export const PAGES: [path: string, heading: string][] = [
  ['dashboard', 'Tổng quan'],
  ['convert', 'Chuyển đổi liên kết'],
  ['links', 'Quản lý liên kết'],
  ['analytics', 'Thống kê'],
  ['orders', 'Đơn hàng & Hoa hồng'],
  ['offers', 'Sản phẩm & Chiến dịch'],
  ['guides', 'Hướng dẫn Affiliate'],
  ['tax', 'Thuế & Thu nhập'],
  ['legal', 'Pháp luật Việt Nam'],
  ['settings', 'Cài đặt']
];

/** Navigates through the sidebar, opening the drawer first on tablet/mobile. */
export async function navTo(page: Page, path: string): Promise<void> {
  // Decided by width, not isVisible(): the shell may still be loading and click() waits for it.
  if ((page.viewportSize()?.width ?? 1440) < 1024) await page.getByTestId('menu-open').click();
  await page.getByTestId(`nav-${path}`).click();
  await expect(page).toHaveURL(new RegExp(`/app/${path}$`));
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const {scrollWidth, clientWidth} = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth
  }));
  expect(scrollWidth, `page scrolls horizontally at ${page.url()}`).toBeLessThanOrEqual(clientWidth);
}

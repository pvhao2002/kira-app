const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Kira.Pham/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.expo/visual-qa');
fs.mkdirSync(out, { recursive: true });
const routes = [
  ['dashboard', '/', 351], ['cards', '/cards', 310], ['benefits', '/benefits', 428], ['profile', '/profile', 511],
  ['accounts', '/investment', 472], ['import', '/import', 379], ['queue', '/queue', 445], ['account-add', '/account-add', 443],
  ['account-edit', '/account-edit?id=ssi', 402], ['source', '/source?id=job-1', 595], ['ai-result', '/ai-result?id=job-1', 447],
  ['draft-edit', '/draft-edit?id=draft-2', 466], ['decision', '/decision?id=draft-2', 514], ['result-partial', '/result-partial', 469, 'reference-partial'],
  ['result-success', '/result-success', 499, 'reference-success'], ['filter', '/filter', 585, 'reference-filter'], ['history-empty', '/history', 630, 'empty'],
  ['history', '/history', 459, 'reference-history'], ['transaction-detail', '/transaction-detail?id=tx-reference', 462, 'reference-history'],
  ['report-create', '/report-create?id=tx-reference', 401, 'reference-history'], ['report-success', '/report-success?id=tx-reference', 455, 'reference-history'],
  ['reports', '/reports', 375, 'reference-history'], ['credit-stats', '/credit-stats', 340], ['account-stats', '/account-stats?id=ssi', 335, 'reference-account'],
];
async function seedScenario(page, name) {
  if (!name) return;
  await page.goto('http://localhost:8083/demo');
  await page.getByText('Khám phá các kịch bản', { exact: false }).waitFor();
  const labels = { 'reference-history': 'Mockup · Lịch sử & chi tiết', 'reference-account': 'Mockup · Thống kê tài khoản', 'reference-partial': 'Mockup · Kết quả một phần', 'reference-success': 'Mockup · Kết quả toàn bộ', 'reference-filter': 'Mockup · Bộ lọc', empty: 'Lịch sử trống' };
  const button = page.getByText(labels[name], { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Mở kịch bản' });
  await button.click();
  await page.getByRole('button', { name: 'Đặt lại và tiếp tục' }).click();
  await page.waitForTimeout(200);
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
  const previous = only && fs.existsSync(path.join(out, 'capture-results.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'capture-results.json'), 'utf8')).filter(r => !only.includes(r.name)) : [];
  const results = [...previous];
  for (const [name, route, referenceWidth, scenario] of routes) {
    if (only && !only.includes(name)) continue;
    const context = await browser.newContext({ viewport: { width: referenceWidth, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:8083/');
    await page.getByText('Chào buổi sáng, Minh Triết', { exact: true }).waitFor();
    await seedScenario(page, scenario);
    await page.goto('http://localhost:8083' + route);
    await page.getByText('KIRA BANK', { exact: true }).first().waitFor();
    await page.waitForTimeout(350);
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    await page.waitForTimeout(150);
    for (const width of process.argv.includes('--all-widths') ? [...new Set([referenceWidth, 360, 390, 430])] : [referenceWidth]) {
      await page.setViewportSize({ width, height: width === referenceWidth ? name === 'filter' ? 714 : 1600 : 844 });
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await page.screenshot({ path: path.join(out, `${name}-${width}-top.png`) });
      const clipping = await page.evaluate(() => [...document.querySelectorAll('[role=button]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('[style*=overflow]'); }).map(e => e.textContent));
      await page.evaluate(() => { for (const e of document.querySelectorAll('div')) if (e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY === 'auto') e.scrollTop = e.scrollHeight; });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(out, `${name}-${width}-bottom.png`) });
      await page.evaluate(() => { for (const e of document.querySelectorAll('div')) if (e.scrollTop) e.scrollTop = 0; });
      results.push({ name, route, width, overflow, clipping, errors });
    }
    console.log(name, errors.length ? errors : 'captured');
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'capture-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

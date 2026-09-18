// Browser interaction checks for the local demo; no backend calls or test runner.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Kira.Pham/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  const errors = [];
  const checks = [];
  page.on('pageerror', e => errors.push(e.message));
  const open = async route => {
    await page.goto('http://localhost:8083' + route);
    await page.getByText('KIRA BANK', {exact: true}).waitFor();
  };
  const state = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('kira-life-demo-v1')));
  const waitSave = () => page.waitForTimeout(200);
  await open('/account-add');
  await page.getByRole('textbox', {name: 'Mã tài khoản *', exact: true}).fill('QA-001');
  await page.getByRole('textbox', {name: 'Tên tài khoản *', exact: true}).fill('Tài khoản kiểm tra');
  await page.getByRole('textbox', {name: 'Tên đăng nhập *', exact: true}).fill('qa_demo');
  await page.getByRole('textbox', {name: 'Email đăng ký *', exact: true}).fill('qa@example.com');
  await page.getByRole('textbox', {name: 'Số điện thoại *', exact: true}).fill('0900000000');
  await page.getByRole('button', {name: 'Tạo tài khoản', exact: true}).click();
  await waitSave();
  let saved = await state();
  const account = saved.accounts.find(a => a.code === 'QA-001');
  assert.ok(account);
  await open('/account-edit?id=' + account.id);
  await page.getByRole('textbox', {name: 'Tên tài khoản *', exact: true}).fill('Tài khoản đã sửa');
  await page.getByRole('button', {name: 'Lưu thay đổi', exact: true}).click();
  await waitSave();
  await open('/investment');
  assert.equal((await state()).accounts.find(a => a.id === account.id).name, 'Tài khoản đã sửa');
  checks.push('Add/edit account survives reload');
  await open('/import');
  await page.getByRole('button', {name: 'Xác nhận các mục đã chọn', exact: true}).click();
  await page.getByRole('button', {name: 'Xác nhận', exact: true}).click();
  await waitSave();
  saved = await state();
  assert.equal(saved.result.added, 1);
  assert.equal(saved.result.unresolved, 1);
  checks.push('Partial confirmation adds only the valid record');
  await open('/decision?id=draft-2');
  await page.getByRole('radio').filter({hasText: 'Gộp với bản ghi có sẵn'}).click();
  await page.getByRole('button', {name: 'Áp dụng cách xử lý', exact: true}).click();
  await waitSave();
  await open('/import');
  await page.getByRole('button', {name: 'Xác nhận các mục đã chọn', exact: true}).click();
  await page.getByRole('button', {name: 'Xác nhận', exact: true}).click();
  await waitSave();
  saved = await state();
  assert.equal(saved.result.updated, 1);
  assert.equal(saved.result.unresolved, 0);
  assert.equal(saved.transactions.length, 4);
  checks.push('Merge resolves conflict without duplicating money');
  await open('/filter');
  await page.getByRole('checkbox', {name: /Nạp tiền/}).click();
  await page.getByRole('checkbox', {name: /Thưởng/}).click();
  await page.getByRole('button', {name: 'Hoàn thành', exact: true}).click();
  await page.getByRole('button', {name: /^Áp dụng bộ lọc/}).click();
  await waitSave();
  saved = await state();
  assert.deepEqual(saved.filter.types, ['deposit', 'bonus']);
  assert.equal(saved.filter.status, 'done');
  checks.push('Multi-type and status filter persists');
  await open('/filter');
  await page.getByRole('textbox', {name: 'Từ ngày', exact: true}).fill('2024-01-01');
  await page.getByRole('textbox', {name: 'Đến ngày', exact: true}).fill('2024-10-18');
  await page.getByRole('button', {name: /^Áp dụng bộ lọc/}).click();
  await page.getByText(/Mỗi lần tra cứu tối đa 90 ngày/).waitFor();
  await page.getByRole('button', {name: 'Đóng', exact: true}).click();
  assert.equal((await state()).filter.from, '');
  checks.push('Invalid date range rejected; cancel discards draft');
  await open('/report-create?id=tx-existing');
  await page.getByRole('textbox', {
    name: 'Mô tả chi tiết sai lệch *',
    exact: true
  }).fill('Đề nghị đối chiếu lại chứng từ giao dịch này.');
  await page.getByRole('button', {name: 'Gửi báo cáo sai lệch', exact: true}).click();
  await waitSave();
  saved = await state();
  assert.equal(saved.reports.length, 2);
  assert.equal(saved.transactions.length, 4);
  await page.getByText('Đã gửi báo cáo sai lệch thành công', {exact: true}).waitFor();
  checks.push('Report saved once; transaction unchanged; success displayed');
  await open('/queue');
  await page.getByRole('button', {name: 'Hủy công việc', exact: true}).click();
  await page.getByRole('button', {name: 'Xác nhận', exact: true}).click();
  await waitSave();
  assert.equal((await state()).jobs.find(j => j.id === 'job-3').status, 'cancelled');
  checks.push('Pending AI job cancellation');
  await page.getByRole('button', {name: 'Thử lại', exact: true}).click();
  await page.waitForTimeout(1800);
  assert.equal((await state()).jobs.find(j => j.id === 'job-4').status, 'ready');
  checks.push('Failed AI job retry');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(__dirname, '../.expo/visual-qa/flow-results.json'), JSON.stringify({
    checks,
    errors
  }, null, 2));
  console.log(JSON.stringify({checks, errors}, null, 2));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});

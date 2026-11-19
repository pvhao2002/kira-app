import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Critical journeys against a real stack. Requires an existing admin and the shared agent key:
 *   E2E_ADMIN_USER / E2E_ADMIN_PASSWORD, E2E_EXTERNAL_API_KEY (= EXTERNAL_API_KEY of the stack)
 *   and E2E_BASE_URL, default http://localhost:8088.
 * Each run uses unique provider/match/event ids, so it can be repeated on the same database.
 */
const ADMIN = process.env['E2E_ADMIN_USER'] ?? '';
const PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? '';
const EXTERNAL_KEY = process.env['E2E_EXTERNAL_API_KEY'] ?? '';
const RUN = Date.now().toString(36);
const PROVIDER_CODE = `e2e-${RUN}`;
const MATCH_ID = `e2e-match-${RUN}`;
const MODEL = { name: `E2E Model ${RUN}`, version: '1.0' };
const samples = join(__dirname, '..', '..', 'docs', 'samples');

test.skip(!ADMIN || !PASSWORD || !EXTERNAL_KEY, 'Set E2E_ADMIN_USER, E2E_ADMIN_PASSWORD and E2E_EXTERNAL_API_KEY');
test.describe.configure({ mode: 'serial' });

let adminSession: string | null = null;

/** Signs in through the UI once per user; later tests reuse the admin session (keeps under the login rate limit). */
async function login(page: Page, user = ADMIN, password = PASSWORD) {
  if (user === ADMIN && adminSession) {
    await page.addInitScript(s => sessionStorage.setItem('matchmind.session', s), adminSession);
    await page.goto('/dashboard');
    await expect(page.locator('.page-title')).toHaveText('Dashboard');
    return;
  }
  await page.goto('/login');
  await page.getByLabel('Username').fill(user);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  if (user === ADMIN) adminSession = await page.evaluate(() => sessionStorage.getItem('matchmind.session'));
}

function livePayload() {
  const p = JSON.parse(readFileSync(join(samples, 'prediction-live.json'), 'utf8'));
  p.eventId = `e2e-evt-${RUN}`;
  delete p.model; // the agent names its model in the X-Model-Name header
  p.match.externalMatchId = MATCH_ID;
  p.match.homeTeam = `Home ${RUN}`;
  return p;
}

async function callback(request: APIRequestContext, path: string, body: unknown) {
  return request.post(`/api/v1/external/${path}`, {
    headers: { 'X-Api-Key': EXTERNAL_KEY, 'X-Provider': PROVIDER_CODE, 'X-Model-Name': MODEL.name, 'X-Model-Version': MODEL.version },
    data: body,
  });
}

test('rejects a wrong password with a clear message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill(ADMIN);
  await page.locator('#password').fill('definitely-not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('login-error')).toContainText('Wrong username or password.');
  await expect(page).toHaveURL(/\/login/);
});

test('callbacks: prediction is idempotent, result settles picks, settle stays advisory', async ({ request }) => {
  const body = livePayload();
  const first = await callback(request, 'predictions', body);
  expect(first.status()).toBe(201);
  const created = await first.json();

  const retry = await callback(request, 'predictions', body);
  expect(retry.status()).toBe(200);
  expect((await retry.json()).duplicate).toBe(true);

  const reused = await callback(request, 'predictions', { ...body, metadata: { changed: true } });
  expect(reused.status()).toBe(409);
  expect((await reused.json()).code).toBe('EVENT_ID_REUSED');

  const unauth = await request.post('/api/v1/external/predictions', { headers: { 'X-Api-Key': 'nope', 'X-Provider': PROVIDER_CODE }, data: body });
  expect(unauth.status()).toBe(401);

  const result = JSON.parse(readFileSync(join(samples, 'match-result.json'), 'utf8'));
  result.externalMatchId = MATCH_ID;
  const res = await callback(request, 'matches/results', result);
  expect(res.status()).toBe(200);
  const applied = await res.json();
  expect(applied.settlement.settled).toBe(3);
  // AH HOME -0.25 on the remaining match from 1-0, final 2-1 => remaining 1-1 => HALF_LOSS.
  const ah = applied.settlement.picks.find((p: { market: string }) => p.market === 'AH');
  expect(ah.result).toBe('HALF_LOSS');

  const ahPickId = created.picks.find((p: { market: string }) => p.market === 'AH').pickId;
  const settle = await callback(request, 'predictions/settle', { externalMatchId: MATCH_ID, aiCalculations: [{ pickId: ahPickId, result: 'WIN', explanation: 'wrong on purpose' }] });
  expect(settle.status()).toBe(200);
  const s = await settle.json();
  const claim = s.picks.find((p: { pickId: string }) => p.pickId === ahPickId);
  expect(claim.result).toBe('HALF_LOSS');
  expect(claim.aiAgrees).toBe(false);
});

test('prediction detail shows odds, settlement history and the raw payload', async ({ page }) => {
  await login(page);
  await page.locator('aside nav').getByRole('link', { name: 'Predictions', exact: true }).click();
  await page.getByLabel('Search').fill(`Home ${RUN}`);
  await page.getByRole('button', { name: 'Apply' }).click();
  const row = page.getByRole('row', { name: new RegExp(`Home ${RUN}`) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Half loss');
  await row.click();

  await expect(page.getByRole('tab', { name: /Picks \(3\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Show settlement history' }).first().click();
  await expect(page.getByText('Auto').first()).toBeVisible();
  await page.getByRole('tab', { name: /Odds/ }).click();
  await expect(page.getByText('Remaining match').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Raw payload' }).click();
  await expect(page.locator('pre.json:visible').first()).toContainText(`e2e-evt-${RUN}`);
});

test('reports: history lists the picks and exports CSV', async ({ page }) => {
  await login(page);
  await page.goto('/reports?tab=history');
  await page.getByLabel('Search').fill(MATCH_ID);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('of 3 picks')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);

  await page.getByRole('tab', { name: 'Market performance' }).click();
  await expect(page.getByRole('cell', { name: 'CORNER_OU', exact: true })).toBeVisible();
});

test('reports: all five reports render with export, column visibility and drill-down', async ({ page }) => {
  await login(page);
  await page.goto('/reports?tab=models');
  await page.getByLabel('Search').fill(MATCH_ID);
  await page.getByRole('button', { name: 'Apply' }).click();
  const modelRow = page.getByRole('row', { name: new RegExp(MODEL.name) });
  await expect(modelRow).toContainText('33.3%');
  await modelRow.getByRole('button', { name: 'Toggle breakdown' }).click();
  await expect(page.getByRole('heading', { name: 'By market' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Premier League', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Prediction history' }).click();
  await expect(page.getByText('of 3 picks')).toBeVisible();
  const header = page.locator('thead th', { hasText: 'Probability' });
  await expect(header).toBeVisible();
  await page.locator('summary', { hasText: 'Columns' }).click();
  await page.getByRole('group', { name: 'Visible columns' }).getByLabel('Probability').uncheck();
  await expect(header).toHaveCount(0);
  await page.getByRole('group', { name: 'Visible columns' }).getByLabel('Probability').check();
  await page.locator('summary', { hasText: 'Columns' }).click();
  await page.getByRole('button', { name: 'Toggle details' }).first().click();
  await expect(page.getByText('Odds, stats, settlement history and raw payload')).toBeVisible();
  const xlsx = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel' }).click();
  expect((await xlsx).suggestedFilename()).toMatch(/\.xlsx$/);

  await page.getByRole('tab', { name: 'Model comparison' }).click();
  await page.getByLabel('Matches with at least').selectOption('1');
  await expect(page.getByRole('link', { name: `Home ${RUN} – Chelsea` }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Monte Carlo' }).click();
  await expect(page.getByText('Simulated predictions')).toBeVisible();
  await page.getByRole('button', { name: 'Toggle distribution' }).first().click();
  await expect(page.getByRole('heading', { name: 'Scoreline distribution' })).toBeVisible();
});

test('detail pages: match result and corners, odds by stage, stats, Monte Carlo; settings; no sideways scroll on mobile', async ({ page }) => {
  await login(page);
  await page.goto('/matches');
  await page.getByLabel('Search matches').fill(MATCH_ID);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('link', { name: `Home ${RUN} – Chelsea` }).click();
  await expect(page.getByRole('img', { name: '2 to 1' }).first()).toBeVisible();   // full time
  await expect(page.getByRole('img', { name: '7 to 4' })).toBeVisible();           // corners
  await expect(page.getByRole('row', { name: new RegExp(MODEL.name) })).toContainText('Half loss');
  await expect(page.getByRole('cell', { name: 'Possession %' })).toBeVisible();

  await page.getByRole('row', { name: new RegExp(MODEL.name) }).getByRole('link').nth(1).click();
  await expect(page.getByRole('tab', { name: /Picks \(3\)/ })).toBeVisible();
  await page.getByRole('tab', { name: /Odds/ }).click();
  for (const stage of ['Opening', 'Pre match', 'Live']) await expect(page.getByRole('cell', { name: new RegExp(`^${stage}`) }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Stats' }).click();
  await expect(page.getByRole('cell', { name: 'Shots', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Monte Carlo' }).click();
  await expect(page.getByText('1000', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Score distribution' })).toBeVisible();

  await page.locator('aside nav').getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /^admin/ }).first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ['/dashboard', '/reports?tab=history', '/predictions', '/prompts']) {
    await page.goto(url);
    // Not 'networkidle': the live prediction stream keeps one request open for as long as the page is.
    await expect(page.locator('.page-title')).not.toHaveText('');
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), url).toBeLessThanOrEqual(390);
  }
});

test('prompt notes: edit, save a new version, and cancel discards', async ({ page }) => {
  await login(page);
  await page.locator('aside nav').getByRole('link', { name: 'Prompt Notes', exact: true }).click();
  await page.getByRole('button', { name: /AI Settlement Calculation Prompt/ }).click();
  await expect(page.locator('.prompt-editor h2')).toHaveText('AI Settlement Calculation Prompt');
  const header = page.locator('.prompt-editor header p');
  const before = Number(/version (\d+)/.exec((await header.textContent()) ?? '')![1]);

  await page.getByTestId('prompt-edit').click();
  const box = page.getByTestId('prompt-content');
  const original = await box.inputValue();
  await box.fill(`${original}\n\n<!-- e2e ${RUN} -->`);
  await page.getByTestId('prompt-save').click();
  await expect(header).toContainText(`version ${before + 1}`);
  await expect(page.getByTestId('prompt-view')).toContainText(`e2e ${RUN}`);

  // Restore the original text, then check that Cancel throws edits away.
  await page.getByTestId('prompt-edit').click();
  await page.getByTestId('prompt-content').fill(original);
  await page.getByTestId('prompt-save').click();
  await expect(header).toContainText(`version ${before + 2}`);
  await page.getByTestId('prompt-edit').click();
  await page.getByTestId('prompt-content').fill('throw this away');
  page.once('dialog', d => d.accept());
  await page.getByTestId('prompt-cancel').click();
  await expect(page.getByTestId('prompt-view')).not.toContainText('throw this away');
});

test('a viewer can read but not change anything', async ({ page, request }) => {
  const login1 = await request.post('/api/v1/auth/login', { data: { username: ADMIN, password: PASSWORD } });
  const token = (await login1.json()).accessToken as string;
  const viewer = `viewer-${RUN}`;
  const created = await request.post('/api/v1/users', { headers: { Authorization: `Bearer ${token}` }, data: { username: viewer, password: 'viewer-pass-123', role: 'VIEWER' } });
  expect(created.status()).toBe(201);

  await login(page, viewer, 'viewer-pass-123');
  // The agent's first prediction created its provider and model; nobody registered them by hand.
  await page.locator('aside nav').getByRole('link', { name: 'AI Models', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(MODEL.name) })).toContainText(PROVIDER_CODE);
  await expect(page.getByRole('button', { name: 'Register model' })).toHaveCount(0);
  await page.locator('aside nav').getByRole('link', { name: 'Prompt Notes', exact: true }).click();
  await expect(page.getByTestId('prompt-copy')).toBeVisible();
  await expect(page.getByTestId('prompt-edit')).toHaveCount(0);

  const vt = (await (await request.post('/api/v1/auth/login', { data: { username: viewer, password: 'viewer-pass-123' } })).json()).accessToken;
  const forbidden = await request.post('/api/v1/users', { headers: { Authorization: `Bearer ${vt}` }, data: { username: `x-${RUN}`, password: 'x-password-123', role: 'VIEWER' } });
  expect(forbidden.status()).toBe(403);
});

test('a new prediction shows up live on the predictions page, without a reload', async ({ page, request }) => {
  const streamOpen = page.waitForResponse(r => r.url().endsWith('/api/v1/events/predictions') && r.status() === 200);
  await login(page);
  await page.goto('/predictions');
  await streamOpen;
  const home = `Live ${RUN}`;
  await page.getByLabel('Search').fill(home);
  await page.getByLabel('Search').press('Enter'); // the live reload keeps the page's filters
  await expect(page.locator('table.dt tbody')).toContainText('No predictions match these filters.');
  let navigations = 0;
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });

  const body = livePayload();
  body.eventId = `e2e-live-evt-${RUN}`;
  body.match.externalMatchId = `e2e-live-${RUN}`;
  body.match.homeTeam = home;
  expect((await callback(request, 'predictions', body)).status()).toBe(201);

  await expect(page.locator('.toast')).toContainText(`${home} – ${body.match.awayTeam}, by ${MODEL.name}`);
  await expect(page.locator('table.dt tbody tr')).toHaveCount(1);
  await expect(page.locator('table.dt tbody')).toContainText(home);
  expect(navigations).toBe(0);
});

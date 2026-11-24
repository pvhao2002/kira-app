import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountLedger, AccountPeriod, AccountTotals } from '../core/models';
import { SERIES } from '../shared/chart';
import { CopyService } from '../shared/copy';
import { AccountPage, periodSeries } from './account';

const zero = { deposits: 0, withdrawals: 0, rewards: 0, profit: 0, depositCount: 0, withdrawalCount: 0, cancelledWithdrawalCount: 0, cancelledWithdrawals: 0 };
const totals: AccountTotals = { deposits: 100, withdrawals: 80, rewards: 5, profit: -20, depositCount: 2, withdrawalCount: 1, cancelledWithdrawalCount: 1, cancelledWithdrawals: 80 };
const at = (periodStart: string, over: Partial<AccountTotals> = {}): AccountPeriod => ({ periodStart, ...zero, ...over });
const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

async function open(reports: AccountLedger['reports'], totalElements = 1) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(AccountPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne('/api/v1/account/transactions?page=0&size=25').flush({
    meta: { page: 0, size: 25, totalElements, totalPages: totalElements ? 1 : 0 },
    transactions: totalElements ? [{ reference: 'WD-17', type: 'DEBIT', status: 'CANCELLED', amount: 80, occurredAt: '2026-11-19T12:00:00Z' }] : [],
    reports,
  });
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const choose = (period: string) => { el.querySelector<HTMLElement>(`[data-period="${period}"]`)!.click(); fixture.detectChanges(); };
  return { fixture, http, el, page: fixture.componentInstance, choose };
}

describe('periodSeries', () => {
  it('returns oldest first and fills a missing week with zeros', () => {
    const rows = periodSeries([at('2026-11-16', { profit: 30 }), at('2026-11-02', { profit: -80 })], 'week', 26);
    expect(rows.map(r => r.periodStart)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(rows[1]).toEqual(at('2026-11-09'));
  });
  it('fills a month across a year boundary', () => {
    expect(periodSeries([at('2027-01-01'), at('2026-11-01')], 'month', 24).map(r => r.periodStart))
      .toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });
  it('keeps only the newest periods', () => {
    expect(periodSeries([at('2026-11-16'), at('2026-11-02')], 'week', 2).map(r => r.periodStart)).toEqual(['2026-11-09', '2026-11-16']);
  });
  it('returns nothing for no periods', () => {
    expect(periodSeries([], 'month', 24)).toEqual([]);
  });
});

describe('Account Management', () => {
  afterEach(() => vi.useRealTimers());

  it('renders the ledger and changes the report period without reloading transactions', async () => {
    const { el, http, choose, fixture } = await open({ allTime: totals, weekly: [at('2026-11-16', totals)], monthly: [] });
    const table = el.querySelector('table[aria-label="Transactions"]')!;
    expect([...table.querySelectorAll('thead th')].map(text)).toEqual(['Date', 'Type', 'Amount', 'Reference', 'Status']);
    const day = table.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(text(day)).toContain('19 Nov 2026');   // grouped by GMT+7 day, collapsed by default
    expect(day.getAttribute('aria-expanded')).toBe('false');
    expect(el.textContent).not.toContain('WD-17');
    day.click();
    fixture.detectChanges();
    expect(day.getAttribute('aria-expanded')).toBe('true');
    expect(el.textContent).toContain('WD-17');
    expect(el.textContent).toContain('Cancelled');
    expect(el.textContent).toContain('-20');
    expect(el.querySelector('table[aria-label="Transactions"] .tag')!.className).toContain('tag-success');   // withdrawal green
    choose('weekly');
    expect(el.textContent).toContain('16 Nov 2026');
    http.verify();
  });

  it('shows all-time KPI tiles, including net, cancelled withdrawals and loss colour', async () => {
    const { el } = await open({ allTime: totals, weekly: [], monthly: [] });
    const tile = (label: string) => [...el.querySelectorAll('.kpi')].find(k => text(k.querySelector('span')) === label)!;
    expect(text(tile('Deposited').querySelector('strong'))).toBe('100');
    expect(text(tile('Withdrawn').querySelector('strong'))).toBe('80');
    expect(text(tile('Bonuses').querySelector('strong'))).toBe('5');
    expect(text(tile('Net incl. bonuses').querySelector('strong'))).toBe('-15');
    const profit = tile('Profit / loss').querySelector('strong')!;
    expect(text(profit)).toBe('-20');
    expect(profit.classList).toContain('loss');
    expect(text(tile('Cancelled withdrawals'))).toContain('80');
    expect(text(tile('Cancelled withdrawals'))).toContain('1 request');
  });

  it('shows dashes, the empty row and no chart on an empty ledger', async () => {
    const { el, choose } = await open({ allTime: zero, weekly: [], monthly: [] }, 0);
    const values = [...el.querySelectorAll('.kpi strong')].map(text);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(v => v === '—')).toBe(true);
    expect(text(el.querySelector('table[aria-label="Cash flow report"]'))).toContain('No transactions in this report.');
    expect(el.querySelector('mm-chart')).toBeNull();
    expect(el.querySelector('.empty-state')).not.toBeNull();
    choose('weekly');
    expect(el.querySelector('mm-chart')).toBeNull();
  });

  it('charts weekly cash flow oldest first with a running profit that ends at the all-time profit', async () => {
    const weekly = [at('2026-11-16', { withdrawals: 30, profit: 30, withdrawalCount: 1 }), at('2026-11-02', { deposits: 80, profit: -80, depositCount: 1 })];
    const { el, page, choose } = await open({ allTime: { ...totals, profit: -20 }, weekly, monthly: [at('2026-11-01')] });
    choose('weekly');
    expect(page.flowChart().labels).toEqual(['2 Nov 2026', '9 Nov 2026', '16 Nov 2026']);
    expect(el.querySelector('mm-chart')).not.toBeNull();
    const color = (i: number) => (page.flowChart().datasets[i].backgroundColor as unknown as () => string)();
    expect(color(0)).toBe(SERIES[1]);
    expect(color(1)).toBe(SERIES[0]);
    const running = page.cumulativeChart().datasets[0];
    expect(running.data).toEqual([-50, -50, -20]);
    expect((running.borderColor as unknown as () => string)()).toBe(SERIES[0]);
    expect(running.data.at(-1)).toBeCloseTo(-20);
  });

  it('shows per-period counts and averages, with a dash for an average over no rows', async () => {
    const weekly = [at('2026-11-16', { ...totals }), at('2026-11-09', { withdrawals: 40, withdrawalCount: 2, profit: 40 })];
    const { el, choose } = await open({ allTime: totals, weekly, monthly: [] });
    choose('weekly');
    const rows = [...el.querySelectorAll('table[aria-label="Cash flow report"] tbody tr')].map(r => [...r.children].map(text));
    const head = [...el.querySelectorAll('table[aria-label="Cash flow report"] thead th')].map(text);
    const col = (name: string) => head.indexOf(name);
    expect(rows[0][col('Deposits #')]).toBe('2');
    expect(rows[0][col('Avg deposit')]).toBe('50');
    expect(rows[0][col('Cancelled withdrawals')]).toBe('80');
    expect(rows[1][col('Avg deposit')]).toBe('—');
    expect(rows[1][col('Avg withdrawal')]).toBe('20');
  });

  it('compares this month with last month when this month has transactions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T03:00:00Z'));
    const { el } = await open({ allTime: totals, weekly: [], monthly: [at('2026-11-01', { profit: 30 }), at('2026-10-01', { profit: -10 })] });
    const tile = [...el.querySelectorAll('.kpi')].find(k => text(k.querySelector('span')) === 'This month')!;
    expect(text(tile.querySelector('strong'))).toBe('30');
    expect(tile.querySelector('strong')!.classList).toContain('win');
    expect(text(tile.querySelector('.kpi-sub'))).toBe('last month -10');
  });

  it('shows zero for this month when the newest month is older (GMT+7 month boundary)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-30T18:00:00Z'));   // already 1 Dec in GMT+7
    const { el } = await open({ allTime: totals, weekly: [], monthly: [at('2026-11-01', { profit: 30 }), at('2026-10-01', { profit: -10 })] });
    const tile = [...el.querySelectorAll('.kpi')].find(k => text(k.querySelector('span')) === 'This month')!;
    expect(text(tile.querySelector('strong'))).toBe('0');
    expect(text(tile.querySelector('.kpi-sub'))).toBe('last month 30');
  });

  it('gets one import prompt for screenshots the user attaches in the AI chat, and copies it', async () => {
    const { fixture, http, el } = await open({ allTime: zero, weekly: [], monthly: [] }, 0);
    const copy = vi.spyOn(TestBed.inject(CopyService), 'copy').mockResolvedValue(true);
    expect(el.querySelector('input[type=file]')).toBeNull();
    el.querySelector<HTMLElement>('[data-action="prompt"]')!.click();
    const req = http.expectOne('/api/v1/account/imports');
    expect(req.request.method).toBe('POST');
    req.flush({ importId: 'abc', prompt: 'Read screenshots for abc' });
    await fixture.whenStable();
    expect(el.textContent).toContain('attach your transaction screenshots');
    el.querySelector<HTMLElement>('[data-action="copy"]')!.click();
    expect(copy).toHaveBeenCalledWith('Read screenshots for abc', 'Account import prompt');
    http.verify();
  });
});

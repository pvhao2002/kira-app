import {TestBed} from '@angular/core/testing';
import {of, throwError} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {AdminInvestmentSummary} from '../../shared/models/api.models';
import {AdminInvestmentSummaryPage} from './admin-investment-summary.page';

const summary: AdminInvestmentSummary = {
  fromDate: '2026-01-01', toDate: '2026-02-28', timeZone: 'Asia/Ho_Chi_Minh',
  currencies: [
    {currency: 'VND', totals: {transactions: 4, users: 2, accounts: 3, deposits: 10999, withdrawals: 1600, bonuses: 100, net: -9399},
      months: [{month: '2026-01', transactions: 3, deposits: 10999, withdrawals: 1600, bonuses: 0, net: -9399}],
      topUsers: [{userId: 2, email: 'b@x.io', fullName: 'Bee', transactions: 1, deposits: 9999, withdrawals: 0, net: -9999}]},
    {currency: 'USD', totals: {transactions: 1, users: 1, accounts: 1, deposits: 50, withdrawals: 0, bonuses: 0, net: -50}, months: [], topUsers: []}]
};

describe('AdminInvestmentSummaryPage', () => {
  const create = (api: unknown) => {
    TestBed.configureTestingModule({imports: [AdminInvestmentSummaryPage], providers: [{provide: ApiService, useValue: api}]});
    const fixture = TestBed.createComponent(AdminInvestmentSummaryPage);
    fixture.detectChanges();
    return fixture;
  };

  it('loads the summary for a 12-month range and renders totals, months and top users', () => {
    const adminInvestmentSummary = vi.fn(() => of(summary));
    const fixture = create({adminInvestmentSummary});
    const [params] = adminInvestmentSummary.mock.calls[0] as unknown as [Record<string, string>];
    expect(params['fromDate'] < params['toDate']).toBe(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Bee · b@x.io');
    expect(text).toContain('2026-01');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('switches currency and shows an error state with retry', () => {
    const adminInvestmentSummary = vi.fn().mockReturnValueOnce(of(summary)).mockReturnValueOnce(throwError(() => new Error('x')));
    const fixture = create({adminInvestmentSummary});
    fixture.componentInstance.currency.set('USD');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()?.currency).toBe('USD');
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unable to load this report');
  });
});

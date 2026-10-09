import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {numberFormat} from '../../../core/i18n/formatters';
import {InvestmentDailyReport, InvestmentDayRow} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

interface MonthGrid {label: string; cells: ({day: number; row: InvestmentDayRow | null} | null)[]}

@Component({
  selector: 'app-daily-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.daily') }}</h2><button class="btn ghost" type="button" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.net') }}</small><strong [class.pos]="data().totals.net >= 0" [class.neg]="data().totals.net < 0">{{ money(data().totals.net) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.daily.activeDays') }}</small><strong>{{ data().days.length }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.daily.avgNet') }}</small><strong>{{ money(data().averageNetPerActiveDay) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.daily.avgTx') }}</small><strong>{{ data().averageTransactionsPerActiveDay }}</strong></article>
        @if (data().best; as day) { <article><small>{{ i18n.t('investmentReports.equity.bestDay') }}</small><strong class="pos">{{ day.date }} · {{ money(day.totals.net) }}</strong></article> }
        @if (data().worst; as day) { <article><small>{{ i18n.t('investmentReports.equity.worstDay') }}</small><strong class="neg">{{ day.date }} · {{ money(day.totals.net) }}</strong></article> }
      </div>
      <div class="tops">
        <div><h3>{{ i18n.t('investmentReports.daily.topBest') }}</h3>@for (row of top().best; track row.date) { <p><span>{{ row.date }}</span><b class="pos">{{ money(row.totals.net) }}</b></p> }</div>
        <div><h3>{{ i18n.t('investmentReports.daily.topWorst') }}</h3>@for (row of top().worst; track row.date) { <p><span>{{ row.date }}</span><b class="neg">{{ money(row.totals.net) }}</b></p> }</div>
      </div>
      @for (month of months(); track month.label) {
        <h3>{{ month.label }}</h3>
        <div class="cal">
          @for (d of weekdayKeys; track d) { <b>{{ i18n.t('investmentReports.activity.d' + d) }}</b> }
          @for (cell of month.cells; track $index) {
            @if (cell === null) { <i></i> } @else {
              <div class="day" [class.active]="cell.row !== null" [style.background]="shade(cell.row)" tabindex="0"
                [title]="cell.row ? label(cell.row) : ''" [attr.role]="cell.row ? 'img' : null" [attr.aria-label]="cell.row ? label(cell.row) : null"><span>{{ cell.day }}</span>
                @if (cell.row) { <small>{{ compact(cell.row.totals.net) }}</small> }</div>
            }
          }
        </div>
      }
    </section>`,
  styles: REPORT_STYLES + `
    .tops { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:18px; }.tops p { display:flex; justify-content:space-between; margin:4px 0; padding:4px 0; border-bottom:1px solid var(--border); font-size:12px; }
    .cal { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:4px; max-width:640px; }.cal b { color:var(--muted); font-size:10px; text-align:center; }
    .day { min-height:52px; padding:4px 6px; border:1px solid var(--border); border-radius:8px; font-size:10px; overflow:hidden; }
    .day span { display:block; color:var(--muted); }.day.active span { color:var(--navy); }.day small { display:block; margin-top:4px; font-size:10px; font-weight:700; overflow-wrap:anywhere; }
    @media (max-width:600px) { .day { min-height:44px; padding:3px; } }`
})
export class DailyReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentDailyReport>();
  readonly currency = input.required<string>();
  readonly fromDate = input.required<string>();
  readonly toDate = input.required<string>();
  readonly weekdayKeys = [1, 2, 3, 4, 5, 6, 7];
  private readonly byDate = computed(() => new Map(this.data().days.map(d => [d.date, d])));
  private readonly maxAbs = computed(() => Math.max(1, ...this.data().days.map(d => Math.abs(d.totals.net))));
  readonly top = computed(() => {
    const sorted = [...this.data().days].sort((a, b) => b.totals.net - a.totals.net);
    return {best: sorted.filter(d => d.totals.net > 0).slice(0, 5), worst: sorted.filter(d => d.totals.net < 0).reverse().slice(0, 5)};
  });
  readonly months = computed<MonthGrid[]>(() => {
    const result: MonthGrid[] = [];
    const end = new Date(`${this.toDate()}T00:00:00Z`);
    let cursor = new Date(`${this.fromDate().slice(0, 7)}-01T00:00:00Z`);
    while (cursor <= end) {
      const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
      const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
      const cells: MonthGrid['cells'] = Array(lead).fill(null);
      for (let day = 1; day <= last; day++) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        cells.push({day, row: this.byDate().get(key) ?? null});
      }
      result.push({label: `${year}-${String(month + 1).padStart(2, '0')}`, cells});
      cursor = new Date(Date.UTC(year, month + 1, 1));
    }
    return result;
  });
  shade(row: InvestmentDayRow | null): string {
    if (!row || row.totals.net === 0) return 'transparent';
    const color = row.totals.net > 0 ? '#2563eb' : '#dc2626';
    return `color-mix(in srgb, ${color} ${Math.round(10 + Math.abs(row.totals.net) / this.maxAbs() * 45)}%, var(--surface))`;
  }
  label(row: InvestmentDayRow): string { return `${row.date} · ${this.money(row.totals.net)} · ${row.totals.count}`; }
  compact(value: number): string {
    return numberFormat(this.i18n.locale(), {notation: 'compact', maximumFractionDigits: 1, signDisplay: 'exceptZero'}).format(value);
  }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  exportCsv(): void {
    downloadCsv(`investment-daily-${this.currency()}.csv`, ['date', 'transactions', 'deposits', 'withdrawals', 'bonuses', 'net', 'currency'], this.data().days.map(d => [d.date, d.totals.count, d.totals.deposits, d.totals.withdrawals, d.totals.bonuses, d.totals.net, this.currency()]));
  }
}

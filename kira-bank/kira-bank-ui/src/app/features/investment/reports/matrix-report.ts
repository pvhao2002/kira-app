import {ChangeDetectionStrategy, Component, computed, inject, input, signal} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {numberFormat} from '../../../core/i18n/formatters';
import {InvestmentMatrixReport, InvestmentMatrixRow} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-matrix-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.matrix') }}</h2>
        <div class="actions"><select [attr.aria-label]="i18n.t('investmentReports.matrix.mode')" (change)="cumulative.set($any($event.target).value === 'cumulative')">
          <option value="monthly" [selected]="!cumulative()">{{ i18n.t('investmentReports.matrix.monthly') }}</option>
          <option value="cumulative" [selected]="cumulative()">{{ i18n.t('investmentReports.matrix.cumulative') }}</option></select>
        <button class="btn ghost" type="button" [disabled]="!data().rows.length" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></div></header>
      <p class="hint">{{ i18n.t('investmentReports.matrix.hint') }}</p>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.account') }}</th>@for (m of data().months; track m) { <th>{{ m }}</th> }<th>{{ i18n.t('investmentReports.seasonality.total') }}</th></tr></thead>
        <tbody>
          @for (row of data().rows; track row.accountId) {
            <tr><td>{{ row.accountName }}</td>@for (cell of values(row); track $index) { <td class="cell" [style.background]="shade(cell)">{{ cell === 0 ? '·' : compact(cell) }}</td> }
              <td [class.pos]="row.total > 0" [class.neg]="row.total < 0">{{ money(row.total) }}</td></tr>
          }
          <tr class="sum"><td>{{ i18n.t('investmentReports.seasonality.total') }}</td>@for (cell of totals(); track $index) { <td [class.pos]="cell > 0" [class.neg]="cell < 0">{{ cell === 0 ? '·' : compact(cell) }}</td> }<td></td></tr>
        </tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `.actions { display:flex; gap:8px; align-items:center; }.actions select { min-height:36px; padding:6px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--navy); }.hint { color:var(--muted); font-size:12px; }.cell { text-align:right; font-size:11px; }.sum td { font-weight:700; border-top:2px solid var(--border); }`
})
export class MatrixReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentMatrixReport>();
  readonly currency = input.required<string>();
  readonly cumulative = signal(false);
  private readonly maxAbs = computed(() => Math.max(1, ...this.data().rows.flatMap(row => this.values(row).map(Math.abs))));
  readonly totals = computed(() => this.cumulative() ? this.data().cumulativeTotals : this.data().monthTotals);
  values(row: InvestmentMatrixRow): number[] { return this.cumulative() ? row.cumulative : row.cells; }
  shade(value: number): string {
    if (!value) return 'transparent';
    return `color-mix(in srgb, ${value > 0 ? '#2563eb' : '#dc2626'} ${Math.round(8 + Math.abs(value) / this.maxAbs() * 40)}%, var(--surface))`;
  }
  compact(value: number): string { return numberFormat(this.i18n.locale(), {notation: 'compact', maximumFractionDigits: 1, signDisplay: 'exceptZero'}).format(value); }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  exportCsv(): void {
    downloadCsv(`investment-matrix-${this.currency()}.csv`, ['account', ...this.data().months, 'total', 'currency'],
      this.data().rows.map(row => [row.accountName, ...row.cells, row.total, this.currency()]));
  }
}

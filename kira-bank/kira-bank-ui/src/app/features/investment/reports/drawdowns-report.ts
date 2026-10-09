import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentDrawdownReport} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-drawdowns-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.drawdowns') }}</h2><button class="btn ghost" type="button" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></header>
      <p class="hint">{{ i18n.t('investmentReports.drawdowns.hint') }}</p>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.drawdowns.count') }}</small><strong>{{ data().count }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.drawdowns.deepest') }}</small><strong class="neg">{{ money(data().deepest) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.drawdowns.longest') }}</small><strong>{{ data().longestDays }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.drawdowns.status') }}</small><strong [class.neg]="data().ongoing" [class.pos]="!data().ongoing">{{ i18n.t(data().ongoing ? 'investmentReports.drawdowns.ongoing' : 'investmentReports.drawdowns.atPeak') }}</strong></article>
      </div>
      @if (!data().episodes.length) { <div class="empty">{{ i18n.t('investmentReports.drawdowns.none') }}</div> } @else {
        <div class="table-wrap"><table>
          <thead><tr><th>{{ i18n.t('investmentReports.drawdowns.peak') }}</th><th>{{ i18n.t('investmentReports.drawdowns.start') }}</th><th>{{ i18n.t('investmentReports.drawdowns.trough') }}</th>
            <th>{{ i18n.t('investmentReports.drawdowns.recovery') }}</th><th>{{ i18n.t('investmentReports.drawdowns.depth') }}</th><th>{{ i18n.t('investmentReports.drawdowns.toTrough') }}</th>
            <th>{{ i18n.t('investmentReports.drawdowns.toRecover') }}</th><th>{{ i18n.t('investmentReports.drawdowns.duration') }}</th></tr></thead>
          <tbody>@for (e of data().episodes; track e.startDate) {
            <tr><td>{{ e.peakDate }}</td><td>{{ e.startDate }}</td><td>{{ e.troughDate }}</td><td>{{ e.recoveryDate ?? i18n.t('investmentReports.drawdowns.ongoing') }}</td>
              <td class="neg">{{ money(e.depth) }}</td><td>{{ e.daysToTrough }}</td><td>{{ e.daysToRecover ?? '—' }}</td><td>{{ e.durationDays }}</td></tr>
          }</tbody>
        </table></div>
      }
    </section>`,
  styles: REPORT_STYLES + `.hint { color:var(--muted); font-size:12px; }.empty { padding:20px; color:var(--muted); text-align:center; }`
})
export class DrawdownsReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentDrawdownReport>();
  readonly currency = input.required<string>();
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  exportCsv(): void {
    downloadCsv(`investment-drawdowns-${this.currency()}.csv`, ['peak_date', 'start', 'trough', 'recovery', 'depth', 'days_to_trough', 'days_to_recover', 'duration_days', 'currency'], this.data().episodes.map(e => [e.peakDate, e.startDate, e.troughDate, e.recoveryDate, e.depth, e.daysToTrough, e.daysToRecover, e.durationDays, this.currency()]));
  }
}

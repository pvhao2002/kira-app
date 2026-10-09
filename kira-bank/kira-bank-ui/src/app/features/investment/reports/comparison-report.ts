import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentComparisonReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-comparison-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.comparison') }}</h2><small>{{ i18n.t('investmentReports.comparison.previous') }}: {{ data().previousFrom }} – {{ data().previousTo }}</small></header>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.comparison.metric') }}</th><th>{{ i18n.t('investmentReports.comparison.current') }}</th><th>{{ i18n.t('investmentReports.comparison.previousPeriod') }}</th><th>{{ i18n.t('investmentReports.periodic.change') }}</th><th>%</th></tr></thead>
        <tbody>@for (d of data().deltas; track d.metric) {
          <tr><td>{{ i18n.t(metricKey(d.metric)) }}</td><td>{{ fmt(d.metric, d.current) }}</td><td>{{ fmt(d.metric, d.previous) }}</td>
            <td [class.pos]="d.change > 0" [class.neg]="d.change < 0">{{ fmt(d.metric, d.change) }}</td>
            <td [class.pos]="d.changePct != null && d.changePct > 0" [class.neg]="d.changePct != null && d.changePct < 0">{{ d.changePct == null ? '—' : d.changePct + '%' }}</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES
})
export class ComparisonReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentComparisonReport>();
  readonly currency = input.required<string>();
  metricKey(metric: string): string { return `investmentReports.metric.${metric.toLowerCase()}`; }
  fmt(metric: string, value: number): string { return metric === 'COUNT' ? String(value) : formatMoney(this.i18n.locale(), this.currency(), value); }
}

import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentInsight, InvestmentInsightsReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

const MONEY_CODES = new Set(['NEGATIVE_MONTH', 'POSITIVE_MONTH']);

@Component({
  selector: 'app-insights-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.insights') }}</h2><small>{{ i18n.t('investmentReports.projection.asOf') }}: {{ data().asOf }}</small></header>
      <p class="hint">{{ i18n.t('investmentReports.insights.hint') }}</p>
      @if (!data().insights.length) { <div class="empty">{{ i18n.t('investmentReports.insights.none') }}</div> }
      <ul class="list">@for (item of data().insights; track $index) {
        <li [class]="'sev ' + item.severity.toLowerCase()"><b>{{ i18n.t('investmentReports.insights.sev.' + item.severity.toLowerCase()) }}</b><span>{{ message(item) }}</span></li>
      }</ul>
    </section>`,
  styles: REPORT_STYLES + `
    .hint { color:var(--muted); font-size:12px; }.empty { padding:20px; color:var(--muted); text-align:center; }
    .list { margin:14px 0 0; padding:0; list-style:none; display:grid; gap:8px; }
    .sev { display:flex; gap:10px; align-items:baseline; padding:10px 12px; border:1px solid var(--border); border-left-width:4px; border-radius:8px; font-size:13px; }
    .sev b { min-width:46px; font-size:10px; letter-spacing:.5px; text-transform:uppercase; }
    .warn { border-left-color:#dc2626; }.warn b { color:#dc2626; }.info { border-left-color:#2563eb; }.info b { color:#2563eb; }.good { border-left-color:#16a34a; }.good b { color:#16a34a; }`
})
export class InsightsReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentInsightsReport>();
  readonly currency = input.required<string>();
  message(item: InvestmentInsight): string {
    const value = item.value == null ? '' : MONEY_CODES.has(item.code) || item.code.startsWith('LARGE_TRANSACTION')
      ? formatMoney(this.i18n.locale(), this.currency(), item.value) : String(item.value);
    return this.i18n.t(`investmentReports.insight.${item.code.toLowerCase()}`, {account: item.accountName ?? '', value, date: item.date ?? ''});
  }
}

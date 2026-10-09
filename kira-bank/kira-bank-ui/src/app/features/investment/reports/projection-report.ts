import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentProjectionReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-projection-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.projection') }}</h2><small>{{ i18n.t('investmentReports.projection.asOf') }}: {{ data().asOf }}</small></header>
      <p class="hint">{{ i18n.t('investmentReports.projection.hint') }}</p>
      @if (data().observedDays < 30) { <p class="hint warn">{{ i18n.t('investmentReports.projection.shortRange') }} ({{ data().observedDays }}/30)</p> }
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.projection.mtd') }}</small><strong [class.pos]="data().monthToDateNet >= 0" [class.neg]="data().monthToDateNet < 0">{{ money(data().monthToDateNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.projection.days') }}</small><strong>{{ data().daysElapsed }} / {{ data().daysElapsed + data().daysRemaining }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.projection.runRate') }}</small><strong>{{ money(data().dailyRunRate30) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.projection.monthEnd') }}</small><strong [class.pos]="data().projectedMonthEnd >= 0" [class.neg]="data().projectedMonthEnd < 0">{{ money(data().projectedMonthEnd) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.projection.next30') }}</small><strong>{{ money(data().projectedNext30) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.projection.year') }}</small><strong>{{ money(data().projectedYear) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.projection.trailing30') }}</small><strong>{{ money(data().trailing30) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.projection.trailing90') }}</small><strong>{{ money(data().trailing90) }}</strong></article>
      </div>
    </section>`,
  styles: REPORT_STYLES + `.hint { color:var(--muted); font-size:12px; line-height:1.5; }.warn { color:#b45309; }`
})
export class ProjectionReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentProjectionReport>();
  readonly currency = input.required<string>();
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
}

import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentPerformanceReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-performance-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.performance') }}</h2></header>
      <p class="hint">{{ i18n.t('investmentReports.performance.hint') }}</p>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.net') }}</small><strong [class.pos]="data().totalNet >= 0" [class.neg]="data().totalNet < 0">{{ money(data().totalNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.winRate') }}</small><strong>{{ pct(data().winRatePct) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.profitFactor') }}</small><strong>{{ ratio(data().profitFactor) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.payoff') }}</small><strong>{{ ratio(data().payoffRatio) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.expectancy') }}</small><strong>{{ money(data().expectancyPerDay) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.median') }}</small><strong>{{ money(data().medianDayNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.avgWin') }}</small><strong class="pos">{{ money(data().averageWin) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.avgLoss') }}</small><strong class="neg">{{ money(data().averageLoss) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.largestWin') }}</small><strong class="pos">{{ money(data().largestWin) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.largestLoss') }}</small><strong class="neg">{{ money(data().largestLoss) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.grossWin') }}</small><strong>{{ money(data().grossWin) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.grossLoss') }}</small><strong>{{ money(data().grossLoss) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.maxDrawdown') }}</small><strong>{{ money(data().maxDrawdown) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.performance.recovery') }}</small><strong>{{ ratio(data().recoveryFactor) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.daily.activeDays') }}</small><strong>{{ data().activeDays }} ({{ data().winDays }} / {{ data().lossDays }})</strong></article>
      </div>
    </section>`,
  styles: REPORT_STYLES + `.hint { color:var(--muted); font-size:12px; line-height:1.5; }`
})
export class PerformanceReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentPerformanceReport>();
  readonly currency = input.required<string>();
  pct(value: number | null): string { return value == null ? '—' : `${value}%`; }
  ratio(value: number | null): string { return value == null ? '—' : String(value); }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
}

import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {dateFormat} from '../../../core/i18n/formatters';
import {InvestmentOverviewReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-overview-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.overview') }}</h2></header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.deposits') }}</small><strong>{{ money(data().totals.deposits) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.withdrawals') }}</small><strong>{{ money(data().totals.withdrawals) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.bonuses') }}</small><strong>{{ money(data().totals.bonuses) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.net') }}</small><strong [class.pos]="data().totals.net >= 0" [class.neg]="data().totals.net < 0">{{ money(data().totals.net) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.netWithBonus') }}</small><strong [class.pos]="data().totals.netWithBonus >= 0" [class.neg]="data().totals.netWithBonus < 0">{{ money(data().totals.netWithBonus) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.payback.recovered') }}</small><strong>{{ data().withdrawalToDepositPct == null ? '—' : data().withdrawalToDepositPct + '%' }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.transactions') }}</small><strong>{{ data().totals.count }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.overview.avgTx') }}</small><strong>{{ money(data().averageTransaction) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.overview.accounts') }}</small><strong>{{ data().activeAccounts }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.daily.activeDays') }}</small><strong>{{ data().activeDays }}</strong></article>
        @if (data().lastAt; as at) { <article><small>{{ i18n.t('investmentReports.overview.lastTx') }}</small><strong>{{ dateTime(at) }}</strong></article> }
        @if (data().firstDate) { <article><small>{{ i18n.t('investmentReports.overview.firstTx') }}</small><strong>{{ data().firstDate }}</strong></article> }
      </div>
      <h3>{{ i18n.t('investmentReports.overview.monthOverMonth') }}</h3>
      <div class="metrics">
        <article><small>{{ data().currentMonth }}</small><strong [class.pos]="data().currentMonthNet >= 0" [class.neg]="data().currentMonthNet < 0">{{ money(data().currentMonthNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.overview.previousMonth') }}</small><strong [class.pos]="data().previousMonthNet >= 0" [class.neg]="data().previousMonthNet < 0">{{ money(data().previousMonthNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.periodic.change') }}</small><strong [class.pos]="data().monthNetChange > 0" [class.neg]="data().monthNetChange < 0">{{ money(data().monthNetChange) }}</strong></article>
        @if (data().bestAccount; as a) { <article><small>{{ i18n.t('investmentReports.overview.best') }}</small><strong [class.pos]="a.net >= 0" [class.neg]="a.net < 0">{{ a.accountName }} · {{ money(a.net) }}</strong></article> }
        @if (data().worstAccount; as a) { <article><small>{{ i18n.t('investmentReports.overview.worst') }}</small><strong [class.pos]="a.net >= 0" [class.neg]="a.net < 0">{{ a.accountName }} · {{ money(a.net) }}</strong></article> }
      </div>
    </section>`,
  styles: REPORT_STYLES
})
export class OverviewReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentOverviewReport>();
  readonly currency = input.required<string>();
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  dateTime(value: string): string { return dateFormat(this.i18n.locale(), {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value)); }
}

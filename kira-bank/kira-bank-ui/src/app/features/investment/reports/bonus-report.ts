import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentBonusReport, InvestmentBonusRow} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-bonus-report',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #table let-title="title" let-first="first" let-rows="rows">
      <h3>{{ title }}</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ first }}</th><th>{{ i18n.t('investmentReports.bonuses') }}</th><th>{{ i18n.t('investmentReports.bonus.count') }}</th><th>{{ i18n.t('investmentReports.deposits') }}</th><th>{{ i18n.t('investmentReports.bonus.pctDeposits') }}</th></tr></thead>
        <tbody>@for (row of rows; track row.key) {
          <tr><td>{{ row.label }}</td><td>{{ money(row.bonuses) }}</td><td>{{ row.bonusCount }}</td><td>{{ money(row.deposits) }}</td><td>{{ pct(row.bonusPctOfDeposits) }}</td></tr>
        }</tbody>
      </table></div>
    </ng-template>
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.bonus') }}</h2><button class="btn ghost" type="button" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.bonuses') }}</small><strong>{{ money(data().totalBonuses) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.deposits') }}</small><strong>{{ money(data().totalDeposits) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.bonus.pctDeposits') }}</small><strong>{{ pct(data().bonusPctOfDeposits) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.bonus.pctProfit') }}</small><strong>{{ pct(data().bonusPctOfPositiveNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.bonus.average') }}</small><strong>{{ money(data().averageBonus) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.bonus.largest') }}</small><strong>{{ money(data().largestBonus) }}</strong></article>
      </div>
      <ng-container *ngTemplateOutlet="table; context: {title: i18n.t('investmentReports.bonus.byMonth'), first: i18n.t('investmentReports.periodic.period'), rows: data().byMonth}"/>
      <ng-container *ngTemplateOutlet="table; context: {title: i18n.t('investmentReports.bonus.byAccount'), first: i18n.t('investmentReports.account'), rows: data().byAccount}"/>
    </section>`,
  styles: REPORT_STYLES
})
export class BonusReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentBonusReport>();
  readonly currency = input.required<string>();
  pct(value: number | null): string { return value == null ? '—' : `${value}%`; }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  private row(r: InvestmentBonusRow): (string | number | null)[] { return [r.label, r.bonuses, r.bonusCount, r.deposits, r.bonusPctOfDeposits, this.currency()]; }
  exportCsv(): void {
    downloadCsv(`investment-bonus-${this.currency()}.csv`, ['scope', 'label', 'bonuses', 'bonus_count', 'deposits', 'bonus_pct_of_deposits', 'currency'], [...this.data().byMonth.map(r => ['month', ...this.row(r)]), ...this.data().byAccount.map(r => ['account', ...this.row(r)])]);
  }
}

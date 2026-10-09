import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentActivityReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

const HOURS = Array.from({length: 24}, (_, i) => i);

@Component({
  selector: 'app-activity-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.activity') }}</h2></header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.activity.busiestDay') }}</small><strong>{{ weekday(data().busiestWeekday) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.activity.busiestHour') }}</small><strong>{{ data().busiestHour }}:00</strong></article>
        <article><small>{{ i18n.t('investmentReports.activity.busiestDom') }}</small><strong>{{ data().busiestDayOfMonth }}</strong></article>
      </div>
      <h3>{{ i18n.t('investmentReports.activity.heatmap') }}</h3>
      <div class="scroll"><table class="heat">
        <thead><tr><th></th>@for (h of hours; track h) { <th>{{ h }}</th> }</tr></thead>
        <tbody>@for (row of data().matrix; track $index; let d = $index) {
          <tr><th>{{ weekday(d + 1) }}</th>@for (count of row; track $index; let h = $index) {
            <td [style.background]="cell(count)" [title]="weekday(d + 1) + ' ' + h + ':00 · ' + count" [attr.aria-label]="weekday(d + 1) + ' ' + h + ':00 · ' + count">{{ count || '' }}</td>
          }</tr>
        }</tbody>
      </table></div>
      <h3>{{ i18n.t('investmentReports.activity.byWeekday') }}</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.activity.day') }}</th><th>{{ i18n.t('investmentReports.transactions') }}</th><th>{{ i18n.t('investmentReports.deposits') }}</th><th>{{ i18n.t('investmentReports.withdrawals') }}</th><th>{{ i18n.t('investmentReports.net') }}</th></tr></thead>
        <tbody>@for (slot of data().byWeekday; track slot.key) {
          <tr><td>{{ weekday(slot.key) }}</td><td>{{ slot.totals.count }}</td><td>{{ money(slot.totals.deposits) }}</td><td>{{ money(slot.totals.withdrawals) }}</td>
            <td [class.pos]="slot.totals.net >= 0" [class.neg]="slot.totals.net < 0">{{ money(slot.totals.net) }}</td></tr>
        }</tbody>
      </table></div>
      <h3>{{ i18n.t('investmentReports.activity.byDom') }}</h3>
      <div class="scroll"><div class="bars" style="min-width:560px">@for (slot of data().byDayOfMonth; track slot.key) {
        <div class="col" role="img" tabindex="0" [title]="slot.key + ' · ' + slot.totals.count + ' · ' + money(slot.totals.net)" [attr.aria-label]="slot.key + ' · ' + slot.totals.count + ' · ' + money(slot.totals.net)">
          <div class="top">@if (slot.totals.net > 0) { <span class="bar pos-bg" [style.height.%]="domHeight(slot.totals.net)"></span> }</div><div class="zero"></div>
          <div class="bottom">@if (slot.totals.net < 0) { <span class="bar neg-bg" [style.height.%]="domHeight(slot.totals.net)"></span> }</div>
          <small>{{ slot.key }}</small></div>
      }</div></div>
    </section>`,
  styles: REPORT_STYLES + `
    .heat { min-width:640px; table-layout:fixed; }.heat th { padding:4px; text-align:center; }.heat tbody th { text-align:left; width:44px; }
    .heat td { height:28px; padding:0; border:2px solid var(--surface); border-radius:4px; text-align:center; font-size:10px; }`
})
export class ActivityReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentActivityReport>();
  readonly currency = input.required<string>();
  readonly hours = HOURS;
  private readonly max = computed(() => Math.max(1, ...this.data().matrix.flat()));
  private readonly domMax = computed(() => Math.max(...this.data().byDayOfMonth.map(slot => Math.abs(slot.totals.net))) || 1);
  domHeight(value: number): number { return Math.abs(value) / this.domMax() * 100; }
  weekday(n: number): string { return this.i18n.t(`investmentReports.activity.d${n}`); }
  cell(count: number): string {
    return count ? `color-mix(in srgb, #2563eb ${Math.round(15 + count / this.max() * 75)}%, var(--surface))` : 'var(--border)';
  }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
}

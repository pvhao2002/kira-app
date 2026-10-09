import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentPeriodicReport} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney} from './report-format';

const GRANULARITIES = ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'];

@Component({
  selector: 'app-periodic-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head">
        <h2>{{ i18n.t('investmentReports.tab.periodic') }}</h2>
        <button class="btn ghost" type="button" [disabled]="!data().rows.length" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button>
        <label><span>{{ i18n.t('investmentReports.periodic.granularity') }}</span>
          <select [value]="granularity()" (change)="granularityChange.emit($any($event.target).value)">
            @for (g of granularities; track g) { <option [value]="g" [selected]="g === granularity()">{{ i18n.t('investmentReports.periodic.' + g.toLowerCase()) }}</option> }
          </select></label>
      </header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.deposits') }}</small><strong>{{ money(data().totals.deposits) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.withdrawals') }}</small><strong>{{ money(data().totals.withdrawals) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.bonuses') }}</small><strong>{{ money(data().totals.bonuses) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.net') }}</small><strong [class.pos]="data().totals.net >= 0" [class.neg]="data().totals.net < 0">{{ money(data().totals.net) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.periodic.average') }}</small><strong>{{ money(data().averageNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.periodic.winning') }}</small><strong>{{ data().profitablePeriods }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.periodic.losing') }}</small><strong>{{ data().losingPeriods }}</strong></article>
        @if (data().best; as best) { <article><small>{{ i18n.t('investmentReports.periodic.best') }}</small><strong>{{ best.period }} · {{ money(best.totals.net) }}</strong></article> }
        @if (data().worst; as worst) { <article><small>{{ i18n.t('investmentReports.periodic.worst') }}</small><strong>{{ worst.period }} · {{ money(worst.totals.net) }}</strong></article> }
      </div>
      <h3>{{ i18n.t('investmentReports.periodic.chart') }}</h3>
      <div class="scroll"><div class="bars" [style.min-width.px]="data().rows.length * (granularity() === 'DAY' ? 9 : 28)">
        @for (row of data().rows; track row.period) {
          <div class="col" role="img" tabindex="0" [title]="row.period + ' · ' + money(row.totals.net)" [attr.aria-label]="row.period + ' · ' + money(row.totals.net)">
            <div class="top">@if (row.totals.net > 0) { <span class="bar pos-bg" [style.height.%]="height(row.totals.net)"></span> }</div>
            <div class="zero"></div>
            <div class="bottom">@if (row.totals.net < 0) { <span class="bar neg-bg" [style.height.%]="height(row.totals.net)"></span> }</div>
            @if ($index % labelStep() === 0 || $last) { <small>{{ row.period }}</small> }
          </div>
        }
      </div></div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>{{ i18n.t('investmentReports.periodic.period') }}</th><th>{{ i18n.t('investmentReports.transactions') }}</th>
          <th>{{ i18n.t('investmentReports.deposits') }}</th><th>{{ i18n.t('investmentReports.withdrawals') }}</th><th>{{ i18n.t('investmentReports.bonuses') }}</th>
          <th>{{ i18n.t('investmentReports.net') }}</th><th>{{ i18n.t('investmentReports.periodic.change') }}</th><th>{{ i18n.t('investmentReports.periodic.cumulative') }}</th>
        </tr></thead>
        <tbody>
          @for (row of reversed(); track row.period) {
            <tr><td>{{ row.period }}</td><td>{{ row.totals.count }}</td><td>{{ money(row.totals.deposits) }}</td><td>{{ money(row.totals.withdrawals) }}</td><td>{{ money(row.totals.bonuses) }}</td>
              <td [class.pos]="row.totals.net >= 0" [class.neg]="row.totals.net < 0">{{ money(row.totals.net) }}</td>
              <td>@if (row.netChangePct != null) { {{ row.netChangePct }}% } @else { — }</td>
              <td>{{ money(row.cumulativeNet) }}</td></tr>
          }
        </tbody>
      </table></div>
    </section>`,
  styles: `
    :host { display:block; color:var(--navy); }
    .panel { padding:20px; border:1px solid var(--border); border-radius:15px; background:var(--surface); }
    .head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }.head h2 { margin:0; font-size:18px; }
    .head label { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:11px; }
    .head select { min-height:36px; padding:6px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--navy); }
    .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; margin:18px 0; }
    .metrics article { min-width:0; padding:10px 12px; border:1px solid var(--border); border-radius:10px; }
    .metrics small { display:block; color:var(--muted); font-size:11px; }.metrics strong { display:block; margin-top:6px; font-size:15px; overflow-wrap:anywhere; }
    .pos { color:#2563eb; font-weight:700; }.neg { color:#dc2626; font-weight:700; }.pos-bg { background:#2563eb; }.neg-bg { background:#dc2626; }
    h3 { margin:20px 0 8px; font-size:14px; }.scroll { overflow-x:auto; }
    .bars { display:flex; gap:6px; min-width:620px; padding-bottom:6px; }.col { display:flex; flex-direction:column; flex:1; min-width:0; align-items:center; }
    .top,.bottom { display:flex; width:100%; height:90px; justify-content:center; }.top { align-items:flex-end; }.bottom { align-items:flex-start; }
    .zero { width:100%; height:1px; background:var(--border); }.bar { width:60%; max-width:34px; min-height:2px; border-radius:3px; }
    .col small { margin-top:6px; color:var(--muted); font-size:10px; white-space:nowrap; }
    .table-wrap { margin-top:20px; overflow-x:auto; }table { width:100%; border-collapse:collapse; font-size:12px; }
    th { padding:9px 8px; color:var(--muted); font-size:10px; font-weight:600; text-align:left; white-space:nowrap; }td { padding:10px 8px; border-top:1px solid var(--border); white-space:nowrap; }`
})
export class PeriodicReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentPeriodicReport>();
  readonly currency = input.required<string>();
  readonly granularity = input.required<string>();
  readonly granularityChange = output<string>();
  readonly granularities = GRANULARITIES;
  readonly reversed = computed(() => [...this.data().rows].reverse());
  private readonly maxAbs = computed(() => Math.max(1, ...this.data().rows.map(row => Math.abs(row.totals.net))));

  exportCsv(): void {
    downloadCsv(`investment-${this.granularity().toLowerCase()}-${this.currency()}.csv`,
      ['period', 'transactions', 'deposits', 'withdrawals', 'bonuses', 'net', 'net_with_bonus', 'cumulative_net', 'change_pct', 'currency'],
      this.data().rows.map(r => [r.period, r.totals.count, r.totals.deposits, r.totals.withdrawals, r.totals.bonuses, r.totals.net,
        r.totals.netWithBonus, r.cumulativeNet, r.netChangePct, this.currency()]));
  }
  readonly labelStep = computed(() => Math.max(1, Math.ceil(this.data().rows.length / 8)));
  height(value: number): number { return Math.abs(value) / this.maxAbs() * 100; }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
}

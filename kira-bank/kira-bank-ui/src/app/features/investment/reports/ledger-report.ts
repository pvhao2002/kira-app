import {ChangeDetectionStrategy, Component, computed, inject, input, signal} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {dateFormat} from '../../../core/i18n/formatters';
import {InvestmentLedgerReport} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-ledger-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.ledger') }}</h2>
        <div class="actions">
          <select [value]="type()" (change)="type.set($any($event.target).value)" [attr.aria-label]="i18n.t('investmentReports.distribution.type')">
            <option value="" [selected]="type() === ''">{{ i18n.t('investmentReports.ledger.allTypes') }}</option>
            @for (item of types; track item) { <option [value]="item" [selected]="item === type()">{{ i18n.t('investmentReports.type.' + item.toLowerCase()) }}</option> }
          </select>
          <button class="btn ghost" type="button" [disabled]="!rows().length" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button>
        </div></header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.transactions') }}</small><strong>{{ type() ? rows().length : data().totals.count }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.net') }}</small><strong [class.pos]="data().totals.net >= 0" [class.neg]="data().totals.net < 0">{{ money(data().totals.net) }}</strong></article>
      </div>
      @if (data().truncated) { <p class="hint">{{ i18n.t('investmentReports.ledger.truncated') }} ({{ data().limit }})</p> }
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.distribution.when') }}</th><th>{{ i18n.t('investmentReports.account') }}</th><th>{{ i18n.t('investmentReports.distribution.type') }}</th>
          <th>{{ i18n.t('investmentReports.distribution.amount') }}</th><th>{{ i18n.t('investmentReports.net') }}</th><th>{{ i18n.t('investmentReports.ledger.running') }}</th></tr></thead>
        <tbody>@for (row of rows(); track $index) {
          <tr><td>{{ dateTime(row.at) }}</td><td>{{ row.accountName }}</td><td>{{ i18n.t('investmentReports.type.' + row.type.toLowerCase()) }}</td><td>{{ money(row.amount) }}</td>
            <td [class.pos]="row.signedNet > 0" [class.neg]="row.signedNet < 0">{{ row.signedNet === 0 ? '—' : money(row.signedNet) }}</td>
            <td [class.pos]="row.runningNet > 0" [class.neg]="row.runningNet < 0">{{ money(row.runningNet) }}</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `.actions { display:flex; gap:8px; align-items:center; }.actions select { min-height:36px; padding:6px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--navy); }.hint { color:var(--muted); font-size:12px; }`
})
export class LedgerReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentLedgerReport>();
  readonly currency = input.required<string>();
  readonly types = ['DEPOSIT', 'WITHDRAWAL', 'BONUS'];
  readonly type = signal('');
  readonly rows = computed(() => this.data().rows.filter(row => !this.type() || row.type === this.type()));
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  dateTime(value: string): string { return dateFormat(this.i18n.locale(), {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value)); }
  exportCsv(): void {
    downloadCsv(`investment-ledger-${this.currency()}.csv`, ['at', 'account', 'type', 'amount', 'net', 'running_net', 'currency'],
      this.rows().map(r => [r.at, r.accountName, r.type, r.amount, r.signedNet, r.runningNet, this.currency()]));
  }
}

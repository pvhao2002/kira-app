import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { apiErrorText } from '../core/http';
import { AccountLedger } from '../core/models';
import { errorMessage, keepPrevious, viewState } from '../core/resource';
import { CopyFallback, CopyService } from '../shared/copy';
import { fmtDateTime } from '../shared/format';
import { Paginator } from '../shared/kit';
import { StateView } from '../shared/ui';

@Component({
  selector: 'mm-account',
  imports: [CopyFallback, DecimalPipe, Paginator, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <section class="panel stack">
        <h2>Import transactions</h2>
        <label for="account-image">Transaction screenshot (PNG or JPEG, up to 8 MiB)</label>
        <input #image id="account-image" type="file" accept="image/png,image/jpeg" [disabled]="uploading()"
          (change)="upload(image.files?.item(0)); image.value = ''" />
        @if (uploadError()) { <p role="alert" class="alert alert-error">{{ uploadError() }}</p> }
        @if (uploading()) { <p role="status">Uploading screenshot…</p> }
        @if (prompt(); as text) {
          <p role="status">Paste the prompt and attach the same screenshot in your AI chat. Refresh transactions after the Sheet syncs.</p>
          <div><button type="button" class="btn btn-primary" data-action="copy" (click)="copy.copy(text, 'Account import prompt')">Copy prompt</button></div>
        }
      </section>
      @if (data(); as ledger) {
        <section class="panel stack">
          <h2>Cash flow</h2>
          <p class="page-note">Profit is successful withdrawals minus successful deposits. Weeks start on Monday. Report periods use GMT+7.</p>
          <div class="filter-bar" role="group" aria-label="Report period">
            @for (option of periods; track option.key) {
              <button type="button" class="btn btn-sm" [class.btn-primary]="period() === option.key"
                [attr.data-period]="option.key" [attr.aria-pressed]="period() === option.key"
                (click)="period.set(option.key)">{{ option.label }}</button>
            }
          </div>
          <div class="table-wrap"><table class="dt" aria-label="Cash flow report">
            <thead><tr><th>Period</th><th class="num">Deposits</th><th class="num">Withdrawals</th><th class="num">Bonuses</th><th class="num">Profit / loss</th></tr></thead>
            <tbody>@for (row of reportRows(); track row.periodStart) {
              <tr><th scope="row">{{ row.periodStart }}</th><td class="num">{{ row.deposits | number:'1.0-8' }}</td>
                <td class="num">{{ row.withdrawals | number:'1.0-8' }}</td><td class="num">{{ row.rewards | number:'1.0-8' }}</td>
                <td class="num" [class.win]="row.profit > 0" [class.loss]="row.profit < 0">{{ row.profit | number:'1.0-8' }}</td></tr>
            } @empty { <tr><td colspan="5" class="empty">No transactions in this report.</td></tr> }</tbody>
          </table></div>
        </section>
        <section class="panel stack">
          <div class="filter-bar"><h2>Transactions</h2><button class="btn btn-sm" type="button" [disabled]="resource.isLoading()" (click)="resource.reload()">Refresh transactions</button></div>
          <div class="table-wrap"><table class="dt" aria-label="Transactions">
            <thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Status</th><th class="num">Amount</th></tr></thead>
            <tbody>@for (txn of ledger.transactions; track txn) {
              <tr><td>{{ fmt(txn.occurredAt) }}</td><td>{{ txn.reference }}</td><td>{{ labels[txn.type] }}</td>
                <td>{{ txn.status }}</td><td class="num">{{ txn.amount | number:'1.0-8' }}</td></tr>
            } @empty { <tr><td colspan="5" class="empty">No imported transactions yet.</td></tr> }</tbody>
          </table></div>
          @if (ledger.meta.totalElements > ledger.meta.size) {
            <mm-paginator [page]="ledger.meta.page" [size]="ledger.meta.size" [total]="ledger.meta.totalElements"
              [sizes]="[]" unit="transactions" (pageChange)="page.set($event.page)" />
          }
        </section>
      } @else {
        <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
      }
    </div>
    <mm-copy-fallback />`,
})
export class AccountPage {
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  readonly copy = inject(CopyService);
  readonly page = signal(0);
  readonly resource = this.api.accountTransactionsResource(this.page, 25);
  readonly data = keepPrevious(this.resource);
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly prompt = signal('');
  readonly period = signal<keyof AccountLedger['reports']>('allTime');
  readonly periods = [{ key: 'allTime', label: 'All time' }, { key: 'weekly', label: 'Weekly' }, { key: 'monthly', label: 'Monthly' }] as const;
  readonly labels = { CREDIT: 'Deposit', DEBIT: 'Withdrawal', REWARD: 'Bonus' };
  readonly fmt = fmtDateTime;
  readonly reportRows = computed(() => {
    const reports = this.data()?.reports;
    const period = this.period();
    if (!reports) return [];
    return period === 'allTime' ? [{ periodStart: 'All time', ...reports.allTime }] : reports[period];
  });

  upload(file?: File | null): void {
    if (!file) return;
    this.prompt.set('');
    this.uploadError.set('');
    this.uploading.set(true);
    this.api.uploadAccountImage(file)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => { this.uploading.set(false); this.prompt.set(result.prompt); },
        error: error => { this.uploading.set(false); this.uploadError.set(apiErrorText(error)); },
      });
  }
}

import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {IconComponent} from '../../shared/icon/icon';
import {
  ApiError,
  InvestmentTransaction,
  InvestmentAccountSummary,
  PageMeta,
  PageResponse
} from '../../shared/models/api.models';

interface HistoryFilters {
  fromDate: string;
  toDate: string;
  type: string;
  status: string
}

const EMPTY_HISTORY_FILTERS: HistoryFilters = {fromDate: '', toDate: '', type: '', status: ''};
const HISTORY_PAGE_SIZE = 20;

@Component({
  selector: 'app-investment-history',
  imports: [CommonModule, FormsModule, CustomSelectComponent, IconComponent],
  templateUrl: './investment-history.page.html',
  styleUrl: './investment-history.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvestmentHistoryPage {
  readonly accounts = signal<InvestmentAccountSummary[]>([]);
  readonly accountId = signal<number | null>(null);
  readonly history = signal<InvestmentTransaction[]>([]);
  readonly historyLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly historyType = signal('');
  readonly historyStatus = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly appliedHistoryFilters = signal<HistoryFilters>({...EMPTY_HISTORY_FILTERS});
  readonly historyMeta = signal<PageMeta>({page: 0, size: HISTORY_PAGE_SIZE, totalElements: 0, totalPages: 0});
  readonly historyFiltersOpen = signal(false);
  readonly pendingDelete = signal<InvestmentTransaction | null>(null);
  readonly deleting = signal(false);
  readonly historyDateRangeInvalid = computed(() =>
    !!this.fromDate() && !!this.toDate() && this.fromDate() > this.toDate());
  readonly historyFilterCount = computed(() =>
    Object.values(this.appliedHistoryFilters()).filter(Boolean).length);
  readonly historyHasFilters = computed(() => this.historyFilterCount() > 0);
  readonly historyRangeStart = computed(() => {
    const meta = this.historyMeta();
    return meta.totalElements ? meta.page * meta.size + 1 : 0;
  });
  readonly historyRangeEnd = computed(() => {
    const meta = this.historyMeta();
    return Math.min((meta.page + 1) * meta.size, meta.totalElements);
  });
  readonly historyCanGoPrevious = computed(() => this.historyMeta().page > 0 && !this.historyLoading());
  readonly historyCanGoNext = computed(() => {
    const meta = this.historyMeta();
    return meta.page + 1 < meta.totalPages && !this.historyLoading();
  });

  readonly accountOptions = computed<SelectOption[]>(() => this.accounts().map(account => ({
    value: account.id,
    label: `${account.accountName} · ${account.currency} · ${this.accountStatusLabel(account.status)}`
  })));
  readonly historyTypeOptions = computed<SelectOption[]>(() => [
    {value: '', label: this.i18n.t('investmentTransactions.allTypes')},
    ...this.transactionTypeOptions()
  ]);
  readonly historyStatusOptions = computed<SelectOption[]>(() => [
    {value: '', label: this.i18n.t('investmentTransactions.allStatuses')},
    ...this.transactionStatusOptions()
  ]);

  private readonly api = inject(ApiService);
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const requestedAccountId = Number(this.route.snapshot.queryParamMap.get('accountId'));
    this.api.page<InvestmentAccountSummary>('investment/accounts', 0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.accounts.set(response.data);
          if (!response.data.length) {
            if (this.route.snapshot.queryParamMap.has('accountId')) {
              this.error.set(this.i18n.t('investmentTransactions.errorReviewTarget'));
            }
            return;
          }
          const requestedAccount = Number.isFinite(requestedAccountId)
            ? response.data.find(account => account.id === requestedAccountId)
            : undefined;
          this.selectAccount((requestedAccount ?? response.data[0]).id, false);
        },
        error: () => this.error.set(this.i18n.t('investmentTransactions.errorAccountLoad'))
      });
  }

  chooseAccount(value: number | string): void {
    const id = Number(value);
    if (!Number.isFinite(id)) return;
    this.selectAccount(id, true);
  }

  private selectAccount(id: number, updateUrl: boolean): void {
    this.accountId.set(id);
    if (updateUrl) {
      this.error.set(null);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {accountId: id},
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
    this.loadHistory(0);
  }

  applyHistoryFilters(): void {
    if (this.historyDateRangeInvalid()) return;
    this.appliedHistoryFilters.set({
      fromDate: this.fromDate(),
      toDate: this.toDate(),
      type: this.historyType(),
      status: this.historyStatus()
    });
    this.historyFiltersOpen.set(false);
    this.loadHistory(0);
  }

  resetHistoryFilters(): void {
    this.fromDate.set('');
    this.toDate.set('');
    this.historyType.set('');
    this.historyStatus.set('');
    this.appliedHistoryFilters.set({...EMPTY_HISTORY_FILTERS});
    this.historyFiltersOpen.set(false);
    this.loadHistory(0);
  }

  goToHistoryPage(page: number): void {
    const meta = this.historyMeta();
    if (page < 0 || page >= meta.totalPages || page === meta.page || this.historyLoading()) return;
    this.loadHistory(page);
  }

  loadHistory(page = 0): void {
    const accountId = this.accountId();
    if (!accountId) return;
    const applied = this.appliedHistoryFilters();
    const filters: Record<string, string | number> = {page, size: HISTORY_PAGE_SIZE, sort: 'transactionAt,desc'};
    if (applied.fromDate) filters['fromDate'] = applied.fromDate;
    if (applied.toDate) filters['toDate'] = applied.toDate;
    if (applied.type) filters['type'] = applied.type;
    if (applied.status) filters['status'] = applied.status;
    this.historyLoading.set(true);
    this.api.investmentTransactions(accountId, filters).subscribe({
      next: (response: PageResponse<InvestmentTransaction>) => {
        this.history.set(response.data);
        this.historyMeta.set(response.meta);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyLoading.set(false);
        this.error.set(this.i18n.t('investmentTransactions.errorHistoryLoad'));
      }
    });
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat(this.locale(), {minimumFractionDigits: 0, maximumFractionDigits: 4}).format(value);
  }

  formatHistoryDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(this.locale(), {
      dateStyle: 'medium'
    }).format(date);
  }

  formatHistoryTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(this.locale(), {
      timeStyle: 'short'
    }).format(date);
  }

  canDeleteTransaction(transaction: InvestmentTransaction): boolean {
    // Bonus has no external id by design; a mission's promised bonus and the real credit once
    // completed can legitimately produce two same-day bonus rows, so always allow deleting the
    // stale/duplicate one. Deposit/withdrawal are only deletable when extraction left no
    // external id (likely dirty data).
    return transaction.transactionType === 'BONUS'
      || ((transaction.transactionType === 'DEPOSIT' || transaction.transactionType === 'WITHDRAWAL')
        && !transaction.externalTransactionId);
  }

  requestDelete(transaction: InvestmentTransaction): void {
    this.pendingDelete.set(transaction);
  }

  confirmDelete(): void {
    const accountId = this.accountId();
    const transaction = this.pendingDelete();
    if (!accountId || !transaction) return;
    this.deleting.set(true);
    this.api.deleteInvestmentTransaction(accountId, transaction.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.toast.show(this.i18n.t('investmentTransactions.deletedToast'), 'success');
        this.loadHistory(this.historyMeta().page);
      },
      error: error => {
        this.deleting.set(false);
        this.error.set(this.errorMessage(error, 'investmentTransactions.errorDelete'));
      }
    });
  }

  transactionTypeIcon(value: string | null): string {
    return ({DEPOSIT: '↓', WITHDRAWAL: '↑', BONUS: '✦'} as Record<string, string>)[value ?? ''] ?? '•';
  }

  transactionAmountPrefix(value: string | null): string {
    return value === 'WITHDRAWAL' ? '−' : value === 'DEPOSIT' || value === 'BONUS' ? '+' : '';
  }

  transactionAmountClass(value: string | null): string {
    return value === 'WITHDRAWAL' ? 'debit' : value === 'DEPOSIT' || value === 'BONUS' ? 'credit' : '';
  }

  transactionTypeLabel(value: string | null): string {
    return this.enumLabel('investmentTransactions.type', value);
  }

  transactionStatusLabel(value: string | null): string {
    return this.enumLabel('investmentTransactions.status', value);
  }

  accountStatusLabel(value: string): string {
    const keys: Record<string, string> = {ACTIVE: 'option.active', INACTIVE: 'option.inactive', CLOSED: 'option.closed'};
    return keys[value]
      ? this.i18n.t(keys[value])
      : this.i18n.t('investmentTransactions.unknownValue');
  }

  private transactionTypeOptions(): SelectOption[] {
    return ['DEPOSIT', 'WITHDRAWAL', 'BONUS'].map(value => ({value, label: this.transactionTypeLabel(value)}));
  }

  private transactionStatusOptions(): SelectOption[] {
    return ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'].map(value => ({
      value, label: this.transactionStatusLabel(value)
    }));
  }

  private enumLabel(prefix: string, value: string | null, aliases: Record<string, string> = {}): string {
    if (!value) return this.i18n.t('investmentTransactions.notSelected');
    const suffix = aliases[value] ?? value.toLowerCase();
    const key = `${prefix}.${suffix}`;
    return this.i18n.has(key)
      ? this.i18n.t(key)
      : this.i18n.t('investmentTransactions.unknownValue');
  }

  private locale(): string {
    return this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US';
  }

  private errorMessage(error: {error?: Partial<ApiError>}, fallbackKey: string): string {
    if (!error.error?.message) return this.i18n.t(fallbackKey);
    const trace = error.error.traceId ? ` · ${this.i18n.t('investmentTransactions.trace', {id: error.error.traceId})}` : '';
    return `${error.error.message}${trace}`;
  }
}

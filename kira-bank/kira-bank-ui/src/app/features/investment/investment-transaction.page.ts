import {ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription, timer} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {
  ApiError,
  InvestmentConfirmItem,
  InvestmentConfirmResponse,
  InvestmentImportBatch,
  InvestmentImportItem,
  InvestmentImportResolution,
  InvestmentTransaction,
  InvestmentAccountSummary,
  PageMeta,
  PageResponse
} from '../../shared/models/api.models';

interface ReviewItem extends InvestmentImportItem {
  selected: boolean;
  resolution: InvestmentImportResolution
}

interface HistoryFilters {
  fromDate: string;
  toDate: string;
  type: string;
  status: string
}

const EMPTY_HISTORY_FILTERS: HistoryFilters = {fromDate: '', toDate: '', type: '', status: ''};
const HISTORY_PAGE_SIZE = 20;

@Component({
  selector: 'app-investment-transaction',
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './investment-transaction.page.html',
  styleUrl: './investment-transaction.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvestmentTransactionPage {
  readonly accounts = signal<InvestmentAccountSummary[]>([]);
  readonly accountId = signal<number | null>(null);
  readonly selectedFiles = signal<File[]>([]);
  readonly batch = signal<InvestmentImportBatch | null>(null);
  readonly reviewItems = signal<ReviewItem[]>([]);
  readonly history = signal<InvestmentTransaction[]>([]);
  readonly confirmResult = signal<InvestmentConfirmResponse | null>(null);
  readonly conflictItemId = signal<string | null>(null);
  readonly activeTab = signal<'import' | 'history'>('import');
  readonly loading = signal(false);
  readonly historyLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly historyType = signal('');
  readonly historyStatus = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly appliedHistoryFilters = signal<HistoryFilters>({...EMPTY_HISTORY_FILTERS});
  readonly historyMeta = signal<PageMeta>({page: 0, size: HISTORY_PAGE_SIZE, totalElements: 0, totalPages: 0});
  readonly historyFiltersOpen = signal(false);
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
  readonly canConfirmBatch = computed(() => {
    const status = this.batch()?.status;
    return !!status && ['READY', 'READY_WITH_ERRORS', 'PARTIALLY_CONFIRMED'].includes(status);
  });
  readonly batchIsWaiting = computed(() => {
    const status = this.batch()?.status;
    return status === 'QUEUED' || status === 'PROCESSING';
  });
  readonly batchIsReadOnly = computed(() => this.batch()?.status === 'CONFIRMED');

  readonly accountOptions = computed<SelectOption[]>(() => this.accounts().map(account => ({
    value: account.id,
    label: `${account.accountName} · ${account.currency} · ${this.accountStatusLabel(account.status)}`
  })));
  readonly reviewTypeOptions = computed<SelectOption[]>(() => this.transactionTypeOptions());
  readonly historyTypeOptions = computed<SelectOption[]>(() => [
    {value: '', label: this.i18n.t('investmentTransactions.allTypes')},
    ...this.transactionTypeOptions()
  ]);
  readonly reviewStatusOptions = computed<SelectOption[]>(() => this.transactionStatusOptions());
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
  private polling?: Subscription;
  private batchRequest?: Subscription;
  private focusReviewWhenReady = false;

  constructor() {
    const requestedAccountId = Number(this.route.snapshot.queryParamMap.get('accountId'));
    const requestedBatchId = this.route.snapshot.queryParamMap.get('batchId')?.trim() || null;
    this.api.page<InvestmentAccountSummary>('investment/accounts', 0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.accounts.set(response.data);
          if (!response.data.length) {
            if (requestedBatchId || this.route.snapshot.queryParamMap.has('accountId')) {
              this.error.set(this.i18n.t('investmentTransactions.errorReviewTarget'));
            }
            return;
          }
          const requestedAccount = Number.isFinite(requestedAccountId)
            ? response.data.find(account => account.id === requestedAccountId)
            : undefined;
          if (requestedAccount) {
            this.selectAccount(requestedAccount.id, false);
            if (requestedBatchId) {
              this.activeTab.set('import');
              this.focusReviewWhenReady = true;
              this.loadBatch(requestedAccount.id, requestedBatchId, true);
            }
          } else {
            this.selectAccount(response.data[0].id, false);
            if (requestedBatchId || this.route.snapshot.queryParamMap.has('accountId')) {
              this.error.set(this.i18n.t('investmentTransactions.errorReviewTarget'));
            }
          }
        },
        error: () => this.error.set(this.i18n.t('investmentTransactions.errorAccountLoad'))
      });
    this.destroyRef.onDestroy(() => {
      this.polling?.unsubscribe();
      this.batchRequest?.unsubscribe();
    });
  }

  chooseAccount(value: number | string): void {
    const id = Number(value);
    if (!Number.isFinite(id)) return;
    this.selectAccount(id, true);
  }

  private selectAccount(id: number, updateUrl: boolean): void {
    this.accountId.set(id);
    this.batch.set(null);
    this.reviewItems.set([]);
    this.confirmResult.set(null);
    this.selectedFiles.set([]);
    this.polling?.unsubscribe();
    this.batchRequest?.unsubscribe();
    this.focusReviewWhenReady = false;
    if (updateUrl) {
      this.error.set(null);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {accountId: id, batchId: null},
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
    this.loadHistory(0);
  }

  chooseFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  dropFiles(event: DragEvent): void {
    event.preventDefault();
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  @HostListener('document:paste', ['$event'])
  pasteImages(event: ClipboardEvent): void {
    if (this.activeTab() !== 'import') return;

    const images = Array.from(event.clipboardData?.items ?? [])
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null)
      .map((file, index) => new File(
        [file],
        `clipboard-${Date.now()}-${index + 1}.${this.clipboardImageExtension(file.type)}`,
        {type: file.type, lastModified: Date.now()}
      ));

    if (!images.length) return;
    event.preventDefault();
    this.addFiles(images);
  }

  removeFile(index: number): void {
    this.selectedFiles.update(files => files.filter((_, current) => current !== index));
  }

  upload(): void {
    const accountId = this.accountId();
    if (!accountId || !this.selectedFiles().length) return;
    this.loading.set(true);
    this.error.set(null);
    this.confirmResult.set(null);
    this.api.createInvestmentTransactionImport(accountId, this.selectedFiles()).subscribe({
      next: batch => {
        this.applyBatch(batch);
        this.updateBatchUrl(accountId, batch.batchId);
        this.selectedFiles.set([]);
        this.loading.set(false);
        this.startPolling(accountId, batch.batchId);
      },
      error: error => {
        this.loading.set(false);
        this.error.set(this.errorMessage(error, 'investmentTransactions.errorCreateBatch'));
      }
    });
  }

  retryFile(attachmentId: number): void {
    const accountId = this.accountId();
    const batch = this.batch();
    if (!accountId || !batch) return;
    this.api.retryInvestmentImportFile(accountId, batch.batchId, attachmentId).subscribe({
      next: response => {
        this.applyBatch(response);
        this.startPolling(accountId, batch.batchId);
      },
      error: error => this.error.set(this.errorMessage(error, 'investmentTransactions.errorRetryFile'))
    });
  }

  confirm(): void {
    const accountId = this.accountId();
    const batch = this.batch();
    if (!accountId || !batch || !this.canConfirmBatch() || !this.reviewItems().length) return;
    const transactions: InvestmentConfirmItem[] = this.reviewItems().map(item => ({
      itemId: item.itemId,
      version: item.version,
      selected: item.selected,
      resolution: item.selected ? item.resolution : 'SKIP',
      transactionType: item.transactionType,
      transactionStatus: item.transactionStatus,
      amount: item.amount,
      currency: item.currency?.toUpperCase() ?? null,
      transactionAt: item.transactionAt,
      externalTransactionId: item.externalTransactionId,
      description: item.description
    }));
    this.loading.set(true);
    this.error.set(null);
    this.api.confirmInvestmentTransactions(accountId, batch.batchId, transactions).subscribe({
      next: result => {
        this.confirmResult.set(result);
        this.loading.set(false);
        this.toast.show(this.i18n.t('investmentTransactions.processedToast', {
          count: result.inserted + result.updated + result.skipped
        }), 'success');
        this.loadBatch(accountId, batch.batchId);
        this.loadHistory();
      },
      error: error => {
        this.loading.set(false);
        this.error.set(this.errorMessage(error, 'investmentTransactions.errorConfirm'));
      }
    });
  }

  openResolution(item: ReviewItem): void {
    this.conflictItemId.set(item.itemId);
  }

  resolveConflict(resolution: InvestmentImportResolution): void {
    const id = this.conflictItemId();
    if (!id) return;
    this.reviewItems.update(items => items.map(item => item.itemId === id ? {...item, resolution} : item));
    this.conflictItemId.set(null);
  }

  conflictItem(): ReviewItem | undefined {
    return this.reviewItems().find(item => item.itemId === this.conflictItemId());
  }

  switchTab(tab: 'import' | 'history'): void {
    this.activeTab.set(tab);
    if (tab === 'history') this.loadHistory(this.historyMeta().page);
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

  toLocalDateTime(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  updateTime(item: ReviewItem, value: string): void {
    item.transactionAt = value ? new Date(value).toISOString() : null;
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat(this.locale(), {minimumFractionDigits: 0, maximumFractionDigits: 4}).format(value);
  }

  formatDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(this.locale(), {
      dateStyle: 'short', timeStyle: 'short'
    }).format(date);
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

  importStatusLabel(value: string): string {
    const keys: Record<string, string> = {
      QUEUED: 'queued', PROCESSING: 'processing', READY: 'ready', READY_WITH_ERRORS: 'readyWithErrors',
      PARTIALLY_CONFIRMED: 'partiallyConfirmed', CONFIRMED: 'confirmed', FAILED: 'failed', CANCELLED: 'cancelled'
    };
    return this.enumLabel('investmentTransactions.importStatus', value, keys);
  }

  processingActionLabel(value: string): string {
    return this.enumLabel('investmentTransactions.action', value);
  }

  resolutionLabel(value: InvestmentImportResolution): string {
    const keys: Record<string, string> = {
      ACCEPT: 'accept', MERGE_EXISTING: 'mergeExisting', SAVE_AS_NEW: 'saveAsNew', SKIP: 'skip'
    };
    return this.enumLabel('investmentTransactions.resolution', value, keys);
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

  private addFiles(incoming: File[]): void {
    const current = this.selectedFiles();
    const combined = [...current, ...incoming];
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (combined.length > 10) {
      this.error.set(this.i18n.t('investmentTransactions.errorTooManyFiles'));
      return;
    }
    if (combined.some(file => file.size === 0 || file.size > 10 * 1024 * 1024 || !allowed.has(file.type))) {
      this.error.set(this.i18n.t('investmentTransactions.errorInvalidFiles'));
      return;
    }
    if (combined.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
      this.error.set(this.i18n.t('investmentTransactions.errorTotalSize'));
      return;
    }
    this.error.set(null);
    this.selectedFiles.set(combined);
  }

  private clipboardImageExtension(mimeType: string): string {
    return mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  }

  private startPolling(accountId: number, batchId: string): void {
    this.polling?.unsubscribe();
    if (this.pollingComplete(this.batch()?.status)) return;
    this.polling = timer(3000, 5000).pipe(
      switchMap(() => this.api.investmentTransactionImport(accountId, batchId)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: batch => {
        this.applyBatch(batch);
        if (this.pollingComplete(batch.status)) this.polling?.unsubscribe();
      },
      error: () => {
        this.polling?.unsubscribe();
        this.error.set(this.i18n.t('investmentTransactions.errorPolling'));
      }
    });
  }

  private loadBatch(accountId: number, batchId: string, fromDeepLink = false): void {
    this.batchRequest?.unsubscribe();
    this.batchRequest = this.api.investmentTransactionImport(accountId, batchId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: batch => {
        this.error.set(null);
        this.applyBatch(batch);
        if (!this.pollingComplete(batch.status)) this.startPolling(accountId, batchId);
      },
      error: error => {
        this.batch.set(null);
        this.reviewItems.set([]);
        this.focusReviewWhenReady = false;
        this.error.set(this.errorMessage(error, fromDeepLink
          ? 'investmentTransactions.errorReviewTarget'
          : 'investmentTransactions.errorBatchLoad'));
      }
    });
  }

  private applyBatch(batch: InvestmentImportBatch): void {
    const previous = new Map(this.reviewItems().map(item => [item.itemId, item]));
    this.batch.set(batch);
    this.reviewItems.set(batch.transactions.map(item => ({
      ...item,
      selected: previous.get(item.itemId)?.selected ?? item.processingAction !== 'IGNORE',
      resolution: previous.get(item.itemId)?.resolution ?? 'ACCEPT'
    })));
    if (this.focusReviewWhenReady && this.pollingComplete(batch.status)) {
      this.focusReviewWhenReady = false;
      setTimeout(() => {
        const targetId = this.canConfirmBatch() ? 'review' : 'batch-review-summary';
        const target = document.getElementById(targetId);
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target?.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'start'});
        target?.focus({preventScroll: true});
      });
    }
  }

  private pollingComplete(status: InvestmentImportBatch['status'] | undefined): boolean {
    return !!status && status !== 'QUEUED' && status !== 'PROCESSING';
  }

  private updateBatchUrl(accountId: number, batchId: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {accountId, batchId},
      queryParamsHandling: 'merge',
      fragment: 'review',
      replaceUrl: true
    });
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

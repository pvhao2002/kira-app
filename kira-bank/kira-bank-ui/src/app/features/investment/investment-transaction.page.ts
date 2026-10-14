import {ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable, Subscription, timer} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {
  ApiError,
  InvestmentConfirmItem,
  InvestmentConfirmResponse,
  InvestmentImportState,
  InvestmentImportItem,
  InvestmentImportResolution,
  InvestmentAccountSummary
} from '../../shared/models/api.models';
import {apiError, apiErrorMessage} from '../../core/services/api-error';

interface ReviewItem extends InvestmentImportItem {
  selected: boolean;
  resolution: InvestmentImportResolution
}

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
  readonly state = signal<InvestmentImportState | null>(null);
  readonly reviewItems = signal<ReviewItem[]>([]);
  readonly confirmResult = signal<InvestmentConfirmResponse | null>(null);
  readonly conflictItemId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly stateLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly accountOptions = computed<SelectOption[]>(() => this.accounts().map(account => ({
    value: account.id,
    label: `${account.accountName} · ${account.currency} · ${this.accountStatusLabel(account.status)}`
  })));
  readonly reviewTypeOptions = computed<SelectOption[]>(() => this.transactionTypeOptions());
  readonly reviewStatusOptions = computed<SelectOption[]>(() => this.transactionStatusOptions());

  private readonly api = inject(ApiService);
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private polling?: Subscription;
  private stateRequest?: Subscription;

  constructor() {
    const requestedAccountId = Number(this.route.snapshot.queryParamMap.get('accountId'));
    this.api.page<InvestmentAccountSummary>('investment/accounts', 0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.accounts.set(response.data);
          if (!response.data.length) return;
          const requested = Number.isFinite(requestedAccountId)
            ? response.data.find(account => account.id === requestedAccountId)
            : undefined;
          this.selectAccount((requested ?? response.data[0]).id, false);
        },
        error: () => this.error.set(this.i18n.t('investmentTransactions.errorAccountLoad'))
      });
    this.destroyRef.onDestroy(() => {
      this.polling?.unsubscribe();
      this.stateRequest?.unsubscribe();
    });
  }

  chooseAccount(value: number | string): void {
    const id = Number(value);
    if (!Number.isFinite(id)) return;
    this.selectAccount(id, true);
  }

  private selectAccount(id: number, updateUrl: boolean): void {
    this.accountId.set(id);
    this.state.set(null);
    this.reviewItems.set([]);
    this.confirmResult.set(null);
    this.selectedFiles.set([]);
    this.polling?.unsubscribe();
    this.error.set(null);
    if (updateUrl) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {accountId: id},
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
    this.loadState(id, true);
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
      next: state => {
        this.applyState(state);
        this.selectedFiles.set([]);
        this.loading.set(false);
        this.startPolling(accountId);
      },
      error: error => {
        this.loading.set(false);
        this.error.set(this.errorMessage(error, 'investmentTransactions.errorUpload'));
      }
    });
  }

  retryFile(attachmentId: number): void {
    this.runJob(this.api.runInvestmentAiJob(attachmentId, false), 'investmentTransactions.errorRetryFile');
  }

  cancelFile(attachmentId: number): void {
    this.runJob(this.api.cancelInvestmentAiJob(attachmentId, false), 'investmentTransactions.errorCancelFile');
  }

  confirm(): void {
    const accountId = this.accountId();
    if (!accountId || !this.reviewItems().length) return;
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
    this.api.confirmInvestmentTransactions(accountId, transactions).subscribe({
      next: result => {
        this.confirmResult.set(result);
        this.loading.set(false);
        this.toast.show(this.i18n.t('investmentTransactions.processedToast', {
          count: result.inserted + result.updated + result.skipped
        }), 'success');
        this.loadState(accountId);
      },
      error: error => {
        this.loading.set(false);
        this.error.set(this.errorMessage(error, 'investmentTransactions.errorConfirm'));
      }
    });
  }

  allSelected(): boolean {
    const items = this.reviewItems();
    return items.length > 0 && items.every(item => item.selected);
  }

  toggleAll(selected: boolean): void {
    this.reviewItems.update(items => items.map(item => ({...item, selected})));
  }

  toggleItem(id: string, selected: boolean): void {
    this.reviewItems.update(items => items.map(item => item.itemId === id ? {...item, selected} : item));
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

  toLocalDateTime(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  updateTime(item: ReviewItem, value: string): void {
    item.transactionAt = value ? new Date(value).toISOString() : null;
  }

  importStatusLabel(value: string): string {
    return this.enumLabel('investmentTransactions.importStatus', value);
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

  transactionTypeLabel(value: string | null): string {
    return this.enumLabel('investmentTransactions.type', value);
  }

  transactionStatusLabel(value: string | null): string {
    return this.enumLabel('investmentTransactions.status', value);
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

  private runJob(request: Observable<unknown>, errorKey: string): void {
    const accountId = this.accountId();
    if (!accountId) return;
    request.subscribe({
      next: () => this.loadState(accountId),
      error: error => this.error.set(this.errorMessage(error, errorKey))
    });
  }

  private hasActiveFiles(state: InvestmentImportState | null): boolean {
    return !!state?.files.some(file => file.aiStatus === 'PENDING' || file.aiStatus === 'PROCESSING');
  }

  private startPolling(accountId: number): void {
    this.polling?.unsubscribe();
    if (!this.hasActiveFiles(this.state())) return;
    this.polling = timer(3000, 5000).pipe(
      switchMap(() => this.api.investmentImportState(accountId)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: state => {
        this.applyState(state);
        if (this.hasActiveFiles(state)) return;
        this.polling?.unsubscribe();
        // READY is set just before auto-commit runs; reload once more to pick up committed/review items.
        this.polling = timer(3000).pipe(
          switchMap(() => this.api.investmentImportState(accountId)),
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({next: latest => this.applyState(latest)});
      },
      error: () => {
        this.polling?.unsubscribe();
        this.error.set(this.i18n.t('investmentTransactions.errorPolling'));
      }
    });
  }

  private loadState(accountId: number, showLoading = false): void {
    this.stateRequest?.unsubscribe();
    this.polling?.unsubscribe();
    this.stateLoading.set(showLoading);
    this.stateRequest = this.api.investmentImportState(accountId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: state => {
        this.stateLoading.set(false);
        this.applyState(state);
        this.startPolling(accountId);
      },
      error: error => {
        this.stateLoading.set(false);
        this.state.set(null);
        this.reviewItems.set([]);
        this.error.set(this.errorMessage(error, 'investmentTransactions.errorStateLoad'));
      }
    });
  }

  private applyState(state: InvestmentImportState): void {
    const previous = new Map(this.reviewItems().map(item => [item.itemId, item]));
    this.state.set(state);
    this.reviewItems.set(state.transactions.map(item => ({
      ...item,
      selected: previous.get(item.itemId)?.selected ?? item.processingAction !== 'IGNORE',
      resolution: previous.get(item.itemId)?.resolution ?? 'ACCEPT'
    })));
  }

  private enumLabel(prefix: string, value: string | null, aliases: Record<string, string> = {}): string {
    if (!value) return this.i18n.t('investmentTransactions.notSelected');
    const suffix = aliases[value] ?? value.toLowerCase();
    const key = `${prefix}.${suffix}`;
    return this.i18n.has(key)
      ? this.i18n.t(key)
      : this.i18n.t('investmentTransactions.unknownValue');
  }

  private errorMessage(error: {error?: Partial<ApiError>}, fallbackKey: string): string {
    const body = apiError(error);
    const message = apiErrorMessage(error, this.i18n.t(fallbackKey));
    const trace = body?.traceId ? ` · ${this.i18n.t('investmentTransactions.trace', {id: body.traceId})}` : '';
    return `${message}${trace}`;
  }
}

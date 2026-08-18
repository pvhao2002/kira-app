import {ChangeDetectionStrategy, Component, DestroyRef, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription, timer} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {
  ApiError,
  InvestmentConfirmItem,
  InvestmentConfirmResponse,
  InvestmentImportBatch,
  InvestmentImportItem,
  InvestmentImportResolution,
  InvestmentTransaction,
  InvestmentAccountSummary,
  PageResponse
} from '../../shared/models/api.models';

interface ReviewItem extends InvestmentImportItem {
  selected: boolean;
  resolution: InvestmentImportResolution
}

@Component({
  selector: 'app-investment-transaction',
  imports: [CommonModule, FormsModule],
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

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private polling?: Subscription;

  constructor() {
    this.api.page<InvestmentAccountSummary>('investment/accounts', 0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.accounts.set(response.data);
          if (response.data.length) this.chooseAccount(response.data[0].id);
        },
        error: () => this.error.set('Không thể tải danh sách tài khoản đầu tư.')
      });
    this.destroyRef.onDestroy(() => this.polling?.unsubscribe());
  }

  chooseAccount(value: number | string): void {
    const id = Number(value);
    if (!Number.isFinite(id)) return;
    this.accountId.set(id);
    this.batch.set(null);
    this.reviewItems.set([]);
    this.confirmResult.set(null);
    this.selectedFiles.set([]);
    this.polling?.unsubscribe();
    this.loadHistory();
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
        this.selectedFiles.set([]);
        this.loading.set(false);
        this.startPolling(accountId, batch.batchId);
      },
      error: error => {
        this.loading.set(false);
        this.error.set(this.errorMessage(error, 'Không thể tạo batch import.'));
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
      error: error => this.error.set(this.errorMessage(error, 'Không thể thử lại ảnh.'))
    });
  }

  confirm(): void {
    const accountId = this.accountId();
    const batch = this.batch();
    if (!accountId || !batch || !this.reviewItems().length) return;
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
        this.toast.show(`Đã xử lý ${result.inserted + result.updated + result.skipped} giao dịch.`, 'success');
        this.loadBatch(accountId, batch.batchId);
        this.loadHistory();
      },
      error: error => {
        this.loading.set(false);
        this.error.set(this.errorMessage(error, 'Không thể xác nhận batch.'));
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
    if (tab === 'history') this.loadHistory();
  }

  loadHistory(): void {
    const accountId = this.accountId();
    if (!accountId) return;
    const filters: Record<string, string | number> = {page: 0, size: 50, sort: 'transactionAt,desc'};
    if (this.fromDate()) filters['fromDate'] = this.fromDate();
    if (this.toDate()) filters['toDate'] = this.toDate();
    if (this.historyType()) filters['type'] = this.historyType();
    if (this.historyStatus()) filters['status'] = this.historyStatus();
    this.historyLoading.set(true);
    this.api.investmentTransactions(accountId, filters).subscribe({
      next: (response: PageResponse<InvestmentTransaction>) => {
        this.history.set(response.data);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyLoading.set(false);
        this.error.set('Không thể tải lịch sử giao dịch.');
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
    return new Intl.NumberFormat('vi-VN', {minimumFractionDigits: 0, maximumFractionDigits: 4}).format(value);
  }

  private addFiles(incoming: File[]): void {
    const current = this.selectedFiles();
    const combined = [...current, ...incoming];
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (combined.length > 10) {
      this.error.set('Mỗi batch chỉ được tối đa 10 ảnh.');
      return;
    }
    if (combined.some(file => file.size === 0 || file.size > 10 * 1024 * 1024 || !allowed.has(file.type))) {
      this.error.set('Chỉ nhận JPEG, PNG, WebP; mỗi ảnh từ 1 byte đến 10 MB.');
      return;
    }
    if (combined.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
      this.error.set('Tổng dung lượng batch không được vượt 50 MB.');
      return;
    }
    this.error.set(null);
    this.selectedFiles.set(combined);
  }

  private startPolling(accountId: number, batchId: string): void {
    this.polling?.unsubscribe();
    if (this.isReviewable(this.batch()?.status)) return;
    this.polling = timer(3000, 5000).pipe(
      switchMap(() => this.api.investmentTransactionImport(accountId, batchId)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: batch => {
        this.applyBatch(batch);
        if (this.isReviewable(batch.status)) this.polling?.unsubscribe();
      },
      error: () => {
        this.polling?.unsubscribe();
        this.error.set('Mất kết nối khi cập nhật trạng thái AI. Bạn có thể tải lại trang.');
      }
    });
  }

  private loadBatch(accountId: number, batchId: string): void {
    this.api.investmentTransactionImport(accountId, batchId).subscribe({
      next: batch => this.applyBatch(batch),
      error: () => this.error.set('Không thể tải lại kết quả batch.')
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
  }

  private isReviewable(status: InvestmentImportBatch['status'] | undefined): boolean {
    return !!status && ['READY', 'READY_WITH_ERRORS', 'PARTIALLY_CONFIRMED', 'CONFIRMED', 'FAILED'].includes(status);
  }

  private errorMessage(error: {error?: Partial<ApiError>}, fallback: string): string {
    return error.error?.message ? `${error.error.message}${error.error.traceId ? ` · Trace ${error.error.traceId}` : ''}` : fallback;
  }
}

import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {finalize} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {DecimalPipe} from '@angular/common';
import {LanguageService} from '../../core/i18n/language.service';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {CustomDatepickerComponent} from '../../shared/custom-datepicker/custom-datepicker';
import {IconComponent} from '../../shared/icon/icon';
import {MoneyInputDirective} from '../../shared/money-input/money-input.directive';

type AccountRow = Record<string, unknown>;
type DraftStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CONFIRMED';

interface AiDraft {
  attachmentId: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'BONUS' | null;
  amount: number | null;
  transactionDate: string | null;
  description: string | null;
  confidence: number | null;
  uncertainFields: string[];
  validationWarnings: string[];
}

interface AttachmentDraft {
  attachmentId: number;
  originalName: string;
  mimeType: string;
  aiStatus: DraftStatus;
  aiAttemptCount: number;
  contentUrl: string;
  draft: AiDraft | null;
  aiError: string | null;
  createdAt: string;
}

interface PageResponse<T> {
  data: T[];
}

@Component({
  selector: 'app-investment-transaction',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    CustomSelectComponent,
    CustomDatepickerComponent,
    IconComponent,
    MoneyInputDirective
  ],
  templateUrl: './investment-transaction.page.html',
  styleUrl: './investment-transaction.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvestmentTransactionPage {
  readonly i18n = inject(LanguageService);
  readonly accounts = signal<AccountRow[]>([]);
  readonly loadingAccounts = signal(true);
  readonly uploadingAi = signal(false);
  readonly loadingDrafts = signal(true);
  readonly submitting = signal(false);
  readonly drafts = signal<AttachmentDraft[]>([]);
  readonly selectedAttachmentId = signal<number | null>(null);
  readonly activePreviewAttachmentId = signal<number | null>(null);
  readonly previewUrls = signal<Record<number, string>>({});
  readonly failedPreviewIds = signal<Record<number, boolean>>({});
  readonly uploadedImageUrl = computed(() => {
    const attachmentId = this.activePreviewAttachmentId();
    return attachmentId === null ? null : this.previewUrls()[attachmentId] ?? null;
  });
  readonly uploadStatus = signal<DraftStatus | null>(null);
  readonly errorMsg = signal<string | null>(null);

  readonly accountOptions = computed<SelectOption[]>(() =>
    this.accounts().map(a => ({
      value: a['id'],
      label: `${a['accountName']} (${a['currency'] ?? 'VND'})`
    }))
  );

  readonly typeOptions: SelectOption[] = [
    {value: 'DEPOSIT', label: this.i18n.t('transaction.typeDeposit')},
    {value: 'WITHDRAWAL', label: this.i18n.t('transaction.typeWithdrawal')},
    {value: 'BONUS', label: this.i18n.t('transaction.typeBonus')}
  ];

  readonly form = new FormGroup({
    accountId: new FormControl<number | null>(null, {validators: [Validators.required]}),
    type: new FormControl<string>('DEPOSIT', {nonNullable: true, validators: [Validators.required]}),
    amount: new FormControl<number | null>(null, {validators: [Validators.required, Validators.min(0.0001)]}),
    datetime: new FormControl<string>(this.formatCurrentDateTime(), {nonNullable: true, validators: [Validators.required]}),
    description: new FormControl<string>('', {nonNullable: true})
  });

  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadingPreviewIds = new Set<number>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      Object.values(this.previewUrls()).forEach(url => URL.revokeObjectURL(url));
    });
    this.loadAccounts();
    this.loadDrafts();
  }

  loadAccounts(): void {
    this.loadingAccounts.set(true);
    this.api.page<AccountRow>('investment/accounts', 0, 100)
      .pipe(finalize(() => this.loadingAccounts.set(false)))
      .subscribe({
        next: res => {
          this.accounts.set(res.data);
          if (res.data.length > 0 && typeof res.data[0]['id'] === 'number') {
            this.form.controls.accountId.setValue(res.data[0]['id'] as number);
          }
        }
      });
  }

  loadDrafts(): void {
    this.loadingDrafts.set(true);
    this.http.get<PageResponse<AttachmentDraft>>('/api/v1/attachments', {
      params: {statuses: 'PENDING,PROCESSING,READY,FAILED', page: 0, size: 50}
    }).pipe(finalize(() => this.loadingDrafts.set(false))).subscribe({
      next: response => {
        this.drafts.set(response.data);
        response.data.forEach(attachment => this.loadPreview(attachment));
      },
      error: () => this.drafts.set([])
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.uploadForAi(input.files[0]);
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files?.[0]) {
      this.uploadForAi(event.dataTransfer.files[0]);
    }
  }

  uploadForAi(file: File): void {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.errorMsg.set('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorMsg.set('File size exceeds 10MB limit.');
      return;
    }
    this.uploadingAi.set(true);
    this.errorMsg.set(null);
    this.selectedAttachmentId.set(null);

    const formData = new FormData();
    formData.append('flow', 'investment');
    formData.append('documentType', 'RECEIPT');
    formData.append('file', file);

    this.http.post<AttachmentDraft>('/api/v1/attachments', formData)
      .pipe(finalize(() => this.uploadingAi.set(false)))
      .subscribe({
        next: attachment => {
          this.activePreviewAttachmentId.set(attachment.attachmentId);
          this.loadPreview(attachment);
          this.uploadStatus.set(attachment.aiStatus);
          this.toast.show('Ảnh đã được lưu và đang chờ job AI xử lý.', 'success');
          this.loadDrafts();
        },
        error: err => this.errorMsg.set(err.error?.message || 'Không thể tải ảnh giao dịch lên.')
      });
  }

  selectDraft(attachment: AttachmentDraft): void {
    if (attachment.aiStatus !== 'READY' || !attachment.draft) {
      return;
    }
    const draft = attachment.draft;
    this.selectedAttachmentId.set(attachment.attachmentId);
    this.activePreviewAttachmentId.set(attachment.attachmentId);
    this.loadPreview(attachment);
    this.uploadStatus.set(attachment.aiStatus);
    this.form.patchValue({
      type: draft.type ?? 'DEPOSIT',
      amount: draft.amount,
      datetime: draft.transactionDate ? this.toInputDateTime(draft.transactionDate) : this.form.controls.datetime.value,
      description: draft.description ?? ''
    });
    this.errorMsg.set(null);
  }

  retryDraft(attachment: AttachmentDraft): void {
    this.http.post<AttachmentDraft>(`/api/v1/attachments/${attachment.attachmentId}/retry`, {})
      .subscribe({
        next: () => {
          this.toast.show('Ảnh đã được đưa lại vào hàng đợi AI.', 'success');
          this.loadDrafts();
        },
        error: err => this.errorMsg.set(err.error?.message || 'Không thể thử lại ảnh này.')
      });
  }

  statusLabel(status: DraftStatus): string {
    return ({
      PENDING: 'Chờ AI',
      PROCESSING: 'Đang xử lý',
      READY: 'Sẵn sàng duyệt',
      FAILED: 'Xử lý lỗi',
      CONFIRMED: 'Đã xác nhận'
    } as Record<DraftStatus, string>)[status];
  }

  previewUrl(attachmentId: number): string | null {
    return this.previewUrls()[attachmentId] ?? null;
  }

  previewFailed(attachmentId: number): boolean {
    return this.failedPreviewIds()[attachmentId] ?? false;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMsg.set(null);
    const val = this.form.getRawValue();
    const payload = {
      accountId: val.accountId,
      type: val.type,
      amount: val.amount,
      transactionDate: val.datetime ? new Date(val.datetime).toISOString() : new Date().toISOString(),
      description: val.description,
      attachmentId: this.selectedAttachmentId()
    };

    this.http.post('/api/v1/investment/transactions', payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.toast.show(this.i18n.t('transaction.successMsg'), 'success');
          this.router.navigateByUrl('/app/investment/accounts');
        },
        error: err => this.errorMsg.set(err.error?.message || 'Failed to record transaction')
      });
  }

  private toInputDateTime(value: string): string {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  private formatCurrentDateTime(): string {
    return this.toInputDateTime(new Date().toISOString());
  }

  private loadPreview(attachment: AttachmentDraft): void {
    const attachmentId = attachment.attachmentId;
    if (this.previewUrls()[attachmentId] || this.loadingPreviewIds.has(attachmentId)) {
      return;
    }

    this.loadingPreviewIds.add(attachmentId);
    this.failedPreviewIds.update(ids => {
      const updated = {...ids};
      delete updated[attachmentId];
      return updated;
    });
    this.http.get(attachment.contentUrl, {responseType: 'blob'})
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingPreviewIds.delete(attachmentId))
      )
      .subscribe({
        next: blob => {
          if (!blob.type.startsWith('image/')) {
            this.handlePreviewError(attachmentId);
            return;
          }
          const previewUrl = URL.createObjectURL(blob);
          this.previewUrls.update(urls => ({...urls, [attachmentId]: previewUrl}));
          if (this.activePreviewAttachmentId() === attachmentId) {
            this.errorMsg.set(null);
          }
        },
        error: () => this.handlePreviewError(attachmentId)
      });
  }

  private handlePreviewError(attachmentId: number): void {
    this.failedPreviewIds.update(ids => ({...ids, [attachmentId]: true}));
    if (this.activePreviewAttachmentId() === attachmentId) {
      this.activePreviewAttachmentId.set(null);
      this.errorMsg.set('Không thể tải ảnh xem trước. Vui lòng thử làm mới.');
    }
  }
}

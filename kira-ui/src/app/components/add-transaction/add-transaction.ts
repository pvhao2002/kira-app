import {Component, inject, OnDestroy, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {ToastService} from '../../config/ToastService';
import {TransactionApiService} from '../../services/transaction-api.service';
import {parseVndInput} from '../../utils/format-vnd';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function defaultLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function defaultLocalTime(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

@Component({
  selector: 'app-add-transaction',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './add-transaction.html',
  styleUrl: './add-transaction.css',
  standalone: true
})
export class AddTransaction implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(TransactionApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly savingManual = signal(false);
  readonly savingReceipt = signal(false);

  readonly manualForm = this.fb.nonNullable.group({
    transactionType: this.fb.nonNullable.control<'deposit' | 'withdraw' | 'bonus'>('deposit', Validators.required),
    amountStr: ['', [Validators.required]],
    transactionDate: [defaultLocalDate(), [Validators.required]],
    transactionTime: [defaultLocalTime(), [Validators.required]],
    description: ['']
  });

  /** Object URL for selected image preview; revoke on clear/destroy. */
  private previewObjectUrl: string | null = null;
  readonly receiptPreviewUrl = signal<string | null>(null);
  readonly receiptFileName = signal<string | null>(null);
  readonly receiptMimeType = signal<string | null>(null);
  readonly receiptReady = signal(false);
  /** Raw data URL from FileReader — sent to API as-is. */
  private receiptDataUrl: string | null = null;

  ngOnDestroy(): void {
    this.clearReceiptPreview();
  }

  onReceiptFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.clearReceiptPreview();
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.toast.error('Vui lòng chọn file ảnh (JPG, PNG, WebP, GIF).');
      input.value = '';
      return;
    }
    this.receiptFileName.set(file.name);
    this.receiptMimeType.set(file.type || null);
    this.receiptReady.set(false);
    this.previewObjectUrl = URL.createObjectURL(file);
    this.receiptPreviewUrl.set(this.previewObjectUrl);

    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      this.receiptDataUrl = typeof r === 'string' ? r : null;
      this.receiptReady.set(!!this.receiptDataUrl);
    };
    reader.readAsDataURL(file);
  }

  private clearReceiptPreview(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
    this.receiptPreviewUrl.set(null);
    this.receiptFileName.set(null);
    this.receiptMimeType.set(null);
    this.receiptReady.set(false);
    this.receiptDataUrl = null;
  }

  clearReceiptSelection(): void {
    this.clearReceiptPreview();
  }

  submitReceipt(): void {
    if (!this.receiptDataUrl) {
      this.toast.error('Chọn ảnh hóa đơn trước khi gửi.');
      return;
    }
    this.savingReceipt.set(true);
    this.api
      .createReceipt({
        imageBase64: this.receiptDataUrl,
        fileName: this.receiptFileName() ?? undefined,
        mimeType: this.receiptMimeType() ?? undefined
      })
      .subscribe({
        next: res => {
          this.savingReceipt.set(false);
          this.toast.success(
            res.pendingAiExtraction
              ? 'Đã tải hóa đơn. Hệ thống sẽ trích xuất bằng AI (vài phút).'
              : 'Đã tạo giao dịch từ hóa đơn.'
          );
          void this.router.navigateByUrl('/transactions');
        },
        error: err => {
          this.savingReceipt.set(false);
          this.toast.error(this.apiErrorMessage(err, 'Không tải được hóa đơn.'));
        }
      });
  }

  submitManual(): void {
    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }
    const v = this.manualForm.getRawValue();
    const amount = parseVndInput(v.amountStr);
    if (amount <= 0) {
      this.toast.error('Số tiền phải lớn hơn 0.');
      return;
    }
    const transactionAt = `${v.transactionDate}T${v.transactionTime.length === 5 ? v.transactionTime + ':00' : v.transactionTime}`;
    this.savingManual.set(true);
    this.api
      .createManual({
        type: v.transactionType,
        amount,
        transactionAt,
        description: v.description.trim() ? v.description.trim() : undefined
      })
      .subscribe({
        next: () => {
          this.savingManual.set(false);
          this.toast.success('Đã lưu giao dịch.');
          void this.router.navigateByUrl('/transactions');
        },
        error: err => {
          this.savingManual.set(false);
          this.toast.error(this.apiErrorMessage(err, 'Không lưu được giao dịch.'));
        }
      });
  }

  private apiErrorMessage(err: unknown, fallback: string): string {
    const e = err as {error?: {message?: string}; message?: string; status?: number};
    if (e?.error && typeof e.error === 'string') {
      return e.error;
    }
    if (e?.error?.message && typeof e.error.message === 'string') {
      return e.error.message;
    }
    if (typeof e?.message === 'string' && e.message) {
      return e.message;
    }
    return fallback;
  }
}

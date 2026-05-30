import {ChangeDetectionStrategy, Component, inject, OnDestroy, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {catchError, distinctUntilChanged, EMPTY, filter, forkJoin, map, Subject, switchMap, takeUntil} from 'rxjs';
import {CreditCardApiService, CreditCardDto, PaymentPageDto} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {formatVnd, parseVndInput} from '../../utils/format-vnd';

@Component({
  selector: 'app-card-payments',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './card-payments.html',
  styleUrl: './card-payments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardPayments implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CreditCardApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  private readonly destroy$ = new Subject<void>();

  readonly loadingCard = signal(true);
  readonly loadingPayments = signal(true);
  readonly error = signal<string | null>(null);
  readonly card = signal<CreditCardDto | null>(null);
  readonly pageData = signal<PaymentPageDto | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly creditCardId = signal<number | null>(null);

  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    paidAt: ['', Validators.required],
    amountStr: ['', Validators.required],
    note: ['']
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map(pm => {
          const raw = pm.get('creditCardId');
          return raw != null ? Number(raw) : NaN;
        }),
        filter(id => Number.isFinite(id) && id > 0),
        distinctUntilChanged(),
        switchMap(id => {
          this.creditCardId.set(id);
          this.error.set(null);
          this.loadingCard.set(true);
          this.loadingPayments.set(true);
          this.pageIndex.set(0);
          return forkJoin({
            card: this.api.get(id),
            payments: this.api.payments(id, 0, this.pageSize())
          }).pipe(
              catchError(err => {
                this.loadingCard.set(false);
                this.loadingPayments.set(false);
                this.card.set(null);
                this.pageData.set(null);
                const msg = err?.error?.message ?? err?.message ?? 'Không tải dữ liệu.';
                this.error.set(typeof msg === 'string' ? msg : 'Không tải dữ liệu.');
                return EMPTY;
              })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: ({card, payments}) => {
          this.card.set(card);
          this.pageData.set(payments);
          this.loadingCard.set(false);
          this.loadingPayments.set(false);
          const today = new Date().toISOString().slice(0, 10);
          this.form.patchValue({paidAt: today});
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected formatVnd(n: number): string {
    return formatVnd(n);
  }

  reloadPayments(): void {
    const id = this.creditCardId();
    if (id == null) {
      return;
    }
    this.loadingPayments.set(true);
    this.api.payments(id, this.pageIndex(), this.pageSize()).subscribe({
      next: p => {
        this.pageData.set(p);
        this.loadingPayments.set(false);
      },
      error: err => {
        this.loadingPayments.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Không tải được lịch sử.';
        this.toast.error(typeof msg === 'string' ? msg : 'Không tải được lịch sử.');
      }
    });
  }

  submitPayment(): void {
    const id = this.creditCardId();
    if (id == null || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const amount = parseVndInput(v.amountStr);
    if (amount <= 0) {
      this.toast.error('Số tiền phải lớn hơn 0.');
      return;
    }
    this.api
      .addPayment(id, {
        paidAt: v.paidAt,
        amount,
        note: v.note.trim() ? v.note.trim() : undefined
      })
      .subscribe({
        next: () => {
          this.toast.success('Đã thêm thanh toán.');
          this.form.patchValue({amountStr: '', note: ''});
          this.reloadPayments();
        },
        error: err => {
          const raw = err?.error?.message ?? err?.message ?? 'Không thêm được.';
          this.toast.error(typeof raw === 'string' ? raw : 'Không thêm được.');
        }
      });
  }

  deletePayment(paymentId: number): void {
    const id = this.creditCardId();
    if (id == null) {
      return;
    }
    if (!globalThis.confirm('Xóa bản ghi thanh toán này?')) {
      return;
    }
    this.deletingId.set(paymentId);
    this.api.deletePayment(id, paymentId).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.toast.success('Đã xóa.');
        this.reloadPayments();
      },
      error: err => {
        this.deletingId.set(null);
        const raw = err?.error?.message ?? err?.message ?? 'Không xóa được.';
        this.toast.error(typeof raw === 'string' ? raw : 'Không xóa được.');
      }
    });
  }

  prev(): void {
    if (this.pageIndex() <= 0) {
      return;
    }
    this.pageIndex.update(p => p - 1);
    this.reloadPayments();
  }

  next(): void {
    const d = this.pageData();
    if (!d || this.pageIndex() >= d.totalPages - 1) {
      return;
    }
    this.pageIndex.update(p => p + 1);
    this.reloadPayments();
  }
}

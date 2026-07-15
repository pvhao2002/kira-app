import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {forkJoin} from 'rxjs';
import {CashbackTransactionDto, CreditCardApiService, CreditCardDto, MccCategoryDto} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {formatVnd, parseVndInput} from '../../utils/format-vnd';

@Component({
  selector: 'app-bank-card-transactions',
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  templateUrl: './bank-card-transactions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankCardTransactions {
  private readonly api = inject(CreditCardApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly rows = signal<CashbackTransactionDto[]>([]);
  readonly cards = signal<CreditCardDto[]>([]);
  readonly mcc = signal<MccCategoryDto[]>([]);
  readonly total = signal(0);
  readonly receiveTarget = signal<CashbackTransactionDto | null>(null);
  readonly receiveSaving = signal(false);

  readonly filters = this.fb.group({
    cardId: [''],
    mccCategoryId: [''],
    status: [''],
    from: [''],
    to: [''],
  });

  readonly receiveForm = this.fb.nonNullable.group({
    amount: ['0'],
    receivedAt: [new Date().toISOString().slice(0, 10)],
  });

  constructor() {
    forkJoin({cards: this.api.list(), mcc: this.api.mccCategories()}).subscribe(({cards, mcc}) => {
      this.cards.set(cards);
      this.mcc.set(mcc);
    });
    this.load();
  }

  load(): void {
    const value = this.filters.getRawValue();
    this.loading.set(true);
    this.api.cashbackTransactions({
      cardId: value.cardId ? Number(value.cardId) : null,
      mccCategoryId: value.mccCategoryId ? Number(value.mccCategoryId) : null,
      status: value.status,
      from: value.from,
      to: value.to,
      size: 100,
    }).subscribe({
      next: page => {
        this.rows.set(page.content);
        this.total.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Không thể tải giao dịch hoàn tiền.');
      }
    });
  }

  reset(): void {
    this.filters.reset({cardId: '', mccCategoryId: '', status: '', from: '', to: ''});
    this.load();
  }

  openReceive(row: CashbackTransactionDto): void {
    this.receiveTarget.set(row);
    this.receiveForm.setValue({
      amount: formatVnd(row.expectedCashbackAmount),
      receivedAt: new Date().toISOString().slice(0, 10),
    });
  }

  closeReceive(): void {
    this.receiveTarget.set(null);
  }

  confirmReceive(): void {
    const target = this.receiveTarget();
    if (!target) return;
    const value = this.receiveForm.getRawValue();
    this.receiveSaving.set(true);
    this.api.receiveCashback(target.transactionId, parseVndInput(value.amount), value.receivedAt).subscribe({
      next: () => {
        this.receiveSaving.set(false);
        this.receiveTarget.set(null);
        this.toast.success('Đã ghi nhận cashback thực nhận.');
        this.load();
      },
      error: err => {
        this.receiveSaving.set(false);
        this.toast.error(err?.error?.message ?? 'Không thể cập nhật cashback.');
      }
    });
  }

  cancel(row: CashbackTransactionDto): void {
    if (!globalThis.confirm(`Hủy giao dịch ${row.billReference || row.transactionId}?`)) return;
    this.api.cancelCashback(row.transactionId).subscribe({
      next: () => {
        this.toast.success('Đã hủy giao dịch.');
        this.load();
      },
      error: err => this.toast.error(err?.error?.message ?? 'Không thể hủy giao dịch.')
    });
  }

  money(value: number | null | undefined): string {
    return formatVnd(value ?? 0);
  }

  statusLabel(status: string): string {
    return status === 'RECEIVED' ? 'Đã hoàn' : status === 'CANCELLED' ? 'Đã hủy' : 'Chờ hoàn';
  }
}

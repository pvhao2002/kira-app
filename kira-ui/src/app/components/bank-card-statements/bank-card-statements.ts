import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {forkJoin, Observable} from 'rxjs';
import {CreditCardApiService, CreditCardDto, StatementCycleDto} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {formatVnd, parseVndInput} from '../../utils/format-vnd';

@Component({
  selector: 'app-bank-card-statements',
  imports: [RouterLink, ReactiveFormsModule, DatePipe],
  templateUrl: './bank-card-statements.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankCardStatements {
  private readonly api = inject(CreditCardApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly cards = signal<CreditCardDto[]>([]);
  readonly rows = signal<StatementCycleDto[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly actionTarget = signal<StatementCycleDto | null>(null);
  readonly actionMode = signal<'issue' | 'payment'>('payment');
  readonly saving = signal(false);

  readonly filters = this.fb.group({cardId: [''], status: [''], month: ['']});
  readonly actionForm = this.fb.nonNullable.group({
    amount: ['', Validators.required],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    note: [''],
  });

  constructor() {
    forkJoin({cards: this.api.list(), statements: this.api.statementCycles({size: 100})}).subscribe({
      next: ({cards, statements}) => {
        this.cards.set(cards);
        this.rows.set(statements.content);
        this.total.set(statements.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Không thể tải dữ liệu sao kê.');
      }
    });
  }

  load(): void {
    const value = this.filters.getRawValue();
    this.loading.set(true);
    this.api.statementCycles({
      cardId: value.cardId ? Number(value.cardId) : null,
      status: value.status,
      month: value.month,
      size: 100,
    }).subscribe({
      next: page => {
        this.rows.set(page.content);
        this.total.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Không thể tải dữ liệu sao kê.');
      }
    });
  }

  reset(): void {
    this.filters.reset({cardId: '', status: '', month: ''});
    this.load();
  }

  openIssue(row: StatementCycleDto): void {
    this.actionMode.set('issue');
    this.actionTarget.set(row);
    this.actionForm.setValue({amount: row.statementAmount ? formatVnd(row.statementAmount) : '', date: new Date().toISOString().slice(0, 10), note: row.note ?? ''});
  }

  openPayment(row: StatementCycleDto): void {
    this.actionMode.set('payment');
    this.actionTarget.set(row);
    this.actionForm.setValue({amount: formatVnd(row.remainingAmount), date: new Date().toISOString().slice(0, 10), note: ''});
  }

  closeAction(): void {
    this.actionTarget.set(null);
  }

  submitAction(): void {
    const target = this.actionTarget();
    if (!target || this.actionForm.invalid) return;
    const value = this.actionForm.getRawValue();
    const amount = parseVndInput(value.amount);
    if (amount <= 0) {
      this.toast.error('Số tiền phải lớn hơn 0.');
      return;
    }
    this.saving.set(true);
    const request: Observable<unknown> = this.actionMode() === 'issue'
      ? this.api.updateStatementCycle(target.creditCardId, target.statementCycleId, {
          statementAmount: amount,
          statementIssuedAt: `${value.date}T00:00:00`,
          note: value.note || null,
        })
      : this.api.addPayment(target.creditCardId, {
          paidAt: value.date,
          amount,
          note: value.note || null,
          statementCycleId: target.statementCycleId,
        });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.actionTarget.set(null);
        this.toast.success(this.actionMode() === 'issue' ? 'Đã chốt sao kê.' : 'Đã ghi nhận thanh toán.');
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'Không thể cập nhật sao kê.');
      }
    });
  }

  money(value: number | null | undefined): string {
    return formatVnd(value ?? 0);
  }

  statusLabel(status: string): string {
    return ({NOT_ISSUED: 'Chưa chốt', UNPAID: 'Chưa thanh toán', PARTIALLY_PAID: 'Đã trả một phần', PAID: 'Đã thanh toán', OVERDUE: 'Quá hạn'} as Record<string, string>)[status] ?? status;
  }
}

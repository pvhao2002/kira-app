import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {CreditCardApiService, CreditCardDto} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {parseVndInput} from '../../utils/format-vnd';

@Component({selector: 'app-bank-card-statement-form', imports: [ReactiveFormsModule, RouterLink], templateUrl: './bank-card-statement-form.html', changeDetection: ChangeDetectionStrategy.OnPush})
export class BankCardStatementForm {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CreditCardApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly cards = signal<CreditCardDto[]>([]);
  readonly saving = signal(false);
  readonly form = this.fb.nonNullable.group({creditCardId: ['', Validators.required], cycleMonth: [new Date().toISOString().slice(0, 7), Validators.required], statementDate: [''], dueDate: [''], statementAmount: [''], issued: [false], note: ['']});

  constructor() {
    this.api.list().subscribe(cards => this.cards.set(cards));
  }

  submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const amount = value.statementAmount ? parseVndInput(value.statementAmount) : null;
    if (value.issued && (amount == null || amount < 0)) {
      this.toast.error('Nhập số tiền sao kê trước khi chốt.');
      return;
    }
    this.saving.set(true);
    this.api.createStatementCycle(Number(value.creditCardId), {cycleMonth: value.cycleMonth, statementDate: value.statementDate || null, dueDate: value.dueDate || null, statementAmount: amount, statementIssuedAt: value.issued ? `${new Date().toISOString().slice(0, 10)}T00:00:00` : null, note: value.note || null}).subscribe({next: () => {this.saving.set(false); this.toast.success('Đã tạo kỳ sao kê.'); void this.router.navigateByUrl('/bank-card/statements');}, error: err => {this.saving.set(false); this.toast.error(err?.error?.message ?? 'Không thể tạo kỳ sao kê.');}});
  }
}

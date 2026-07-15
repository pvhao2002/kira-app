import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {ReactiveFormsModule, FormBuilder, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {forkJoin} from 'rxjs';
import {CreditCardApiService, CreditCardDto, MccCategoryDto} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {formatVnd, parseVndInput} from '../../utils/format-vnd';

@Component({
  selector: 'app-bank-card-transaction-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './bank-card-transaction-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankCardTransactionForm {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CreditCardApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly cards = signal<CreditCardDto[]>([]);
  readonly mcc = signal<MccCategoryDto[]>([]);
  readonly saving = signal(false);
  readonly formTick = signal(0);

  readonly form = this.fb.nonNullable.group({
    creditCardId: ['', Validators.required],
    mccCategoryId: [''],
    transactionDate: [new Date().toISOString().slice(0, 10), Validators.required],
    customerName: [''],
    billReference: [''],
    description: [''],
    spendAmount: ['', Validators.required],
    discountRate: ['3', Validators.required],
    manualCashbackRate: [''],
    cashbackDueDate: [''],
    note: [''],
  });

  readonly selectedRule = computed(() => {
    this.formTick();
    const cardId = Number(this.form.controls.creditCardId.value);
    const categoryId = Number(this.form.controls.mccCategoryId.value);
    const date = this.form.controls.transactionDate.value;
    const category = this.mcc().find(item => item.mccCategoryId === categoryId);
    return category?.rules.find(rule => rule.creditCardId === cardId && rule.active
      && rule.effectiveFrom <= date && (!rule.effectiveTo || rule.effectiveTo >= date));
  });

  constructor() {
    forkJoin({cards: this.api.list(), mcc: this.api.mccCategories()}).subscribe(({cards, mcc}) => {
      this.cards.set(cards);
      this.mcc.set(mcc);
      if (cards.length === 1) this.form.controls.creditCardId.setValue(String(cards[0].creditCardId));
    });
    this.form.valueChanges.subscribe(() => this.formTick.update(value => value + 1));
  }

  previewCost(): number {
    return this.amount() * this.rate(this.form.controls.discountRate.value) / 100;
  }

  previewSpend(): number {
    return this.amount();
  }

  previewCashback(): number {
    const rate = this.selectedRule()?.cashbackRate ?? this.rate(this.form.controls.manualCashbackRate.value);
    const raw = this.amount() * rate / 100;
    const cap = this.selectedRule()?.monthlyCapAmount;
    return cap == null ? raw : Math.min(raw, cap);
  }

  previewNet(): number {
    return this.previewCashback() - this.previewCost();
  }

  money(value: number): string {
    return formatVnd(value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const spendAmount = parseVndInput(value.spendAmount);
    if (spendAmount <= 0) {
      this.toast.error('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }
    this.saving.set(true);
    this.api.createCashbackTransaction({
      creditCardId: Number(value.creditCardId),
      mccCategoryId: value.mccCategoryId ? Number(value.mccCategoryId) : null,
      transactionDate: value.transactionDate,
      customerName: value.customerName || null,
      billReference: value.billReference || null,
      description: value.description || null,
      spendAmount,
      discountRate: this.rate(value.discountRate),
      manualCashbackRate: this.selectedRule() ? null : this.rate(value.manualCashbackRate),
      cashbackDueDate: value.cashbackDueDate || null,
      note: value.note || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Đã thêm giao dịch hoàn tiền.');
        void this.router.navigateByUrl('/bank-card/transactions');
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'Không thể thêm giao dịch.');
      }
    });
  }

  private amount(): number {
    return parseVndInput(this.form.controls.spendAmount.value);
  }

  private rate(value: string): number {
    return Number(String(value).replace(',', '.')) || 0;
  }
}

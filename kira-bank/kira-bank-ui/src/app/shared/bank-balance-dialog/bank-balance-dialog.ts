import {ChangeDetectionStrategy, Component, effect, ElementRef, input, output, viewChild} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {LanguageService} from '../../core/i18n/language.service';
import {inject} from '@angular/core';
import {MoneyInputDirective} from '../money-input/money-input.directive';

export interface BankBalanceDialogTarget {
  bankId: number;
  bankName: string;
  remainingBalance: number;
  creditLimit: number;
  currency: string;
  balanceVersion: number
}

export interface BankBalanceDialogValue {
  remainingBalance: number;
  reason: string
}

@Component({
  selector: 'app-bank-balance-dialog',
  imports: [ReactiveFormsModule, MoneyInputDirective],
  templateUrl: './bank-balance-dialog.html',
  styleUrl: './bank-balance-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankBalanceDialogComponent {
  readonly bank = input.required<BankBalanceDialogTarget>();
  readonly saving = input(false);
  readonly error = input('');
  readonly closed = output<void>();
  readonly saved = output<BankBalanceDialogValue>();
  readonly i18n = inject(LanguageService);
  readonly balanceInput = viewChild<ElementRef<HTMLInputElement>>('balanceInput');

  readonly form = new FormGroup({
    remainingBalance: new FormControl<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(999_999_999_999_999.9999)
      ]
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)]
    })
  });

  constructor() {
    effect(() => {
      const bank = this.bank();
      this.form.controls.remainingBalance.setValidators([
        Validators.required,
        Validators.min(0),
        Validators.max(bank.creditLimit)
      ]);
      this.form.controls.remainingBalance.setValue(bank.remainingBalance, {emitEvent: false});
      this.form.controls.remainingBalance.updateValueAndValidity({emitEvent: false});
      setTimeout(() => this.balanceInput()?.nativeElement.focus());
    });
  }

  dismiss(): void {
    if (!this.saving()) this.closed.emit();
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.remainingBalance === null) return;
    this.saved.emit({
      remainingBalance: value.remainingBalance,
      reason: value.reason.trim()
    });
  }

  formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 4
    }).format(value);
  }
}

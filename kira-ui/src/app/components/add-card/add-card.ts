import {DecimalPipe} from '@angular/common';
import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {CreditCardApiService} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {formatVnd, parseVndInput} from '../../utils/format-vnd';

@Component({
  selector: 'app-add-card',
  imports: [RouterLink, ReactiveFormsModule, DecimalPipe],
  templateUrl: './add-card.html',
  styleUrl: './add-card.css',
  standalone: true
})
export class AddCard {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CreditCardApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly saving = signal(false);

  readonly dayOptions = Array.from({length: 31}, (_, i) => i + 1);

  readonly form = this.fb.nonNullable.group({
    bankName: ['VIETCOMBANK', [Validators.required, Validators.maxLength(128)]],
    cardLabel: ['Techcombank Visa', [Validators.required, Validators.maxLength(256)]],
    lastFour: ['', [Validators.pattern(/^(|\d{4})$/)]],
    creditLimitStr: ['50.000.000', [Validators.required]],
    outstandingBalanceStr: ['0', [Validators.required]],
    cardholderName: ['NGUYEN VAN A', [Validators.required, Validators.maxLength(128)]],
    statementDay: [20, [Validators.required, Validators.min(1), Validators.max(31)]],
    paymentDueDay: [5, [Validators.required, Validators.min(1), Validators.max(31)]],
    reminderTime: ['09:00', [Validators.required, Validators.pattern(/^\d{2}:\d{2}(:\d{2})?$/)]]
  });

  previewLimit(): string {
    return formatVnd(parseVndInput(this.form.controls.creditLimitStr.value));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const creditLimit = parseVndInput(v.creditLimitStr);
    const outstandingBalance = parseVndInput(v.outstandingBalanceStr);
    if (creditLimit <= 0) {
      this.toast.error('Hạn mức phải lớn hơn 0.');
      return;
    }
    const lastFour = v.lastFour.trim();
    this.saving.set(true);
    this.api
      .create({
        bankName: v.bankName.trim(),
        cardLabel: v.cardLabel.trim(),
        lastFour: lastFour.length === 4 ? lastFour : undefined,
        creditLimit,
        outstandingBalance,
        cardholderName: v.cardholderName.trim(),
        statementDay: v.statementDay,
        paymentDueDay: v.paymentDueDay,
        reminderTime: v.reminderTime.trim().slice(0, 5)
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Đã lưu thẻ.');
          void this.router.navigateByUrl('/cards');
        },
        error: err => {
          this.saving.set(false);
          const raw = err?.error?.message ?? err?.message ?? 'Không lưu được.';
          this.toast.error(typeof raw === 'string' ? raw : 'Không lưu được.');
        }
      });
  }
}

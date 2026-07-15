import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormArray, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {CreditCardApiService, CreditCardDto} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {parseVndInput} from '../../utils/format-vnd';

@Component({selector: 'app-bank-card-mcc-form', imports: [ReactiveFormsModule, RouterLink], templateUrl: './bank-card-mcc-form.html', changeDetection: ChangeDetectionStrategy.OnPush})
export class BankCardMccForm {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CreditCardApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly cards = signal<CreditCardDto[]>([]);
  readonly saving = signal(false);
  readonly form = this.fb.nonNullable.group({mccCode: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]], categoryName: ['', Validators.required], description: [''], rules: this.fb.array([this.createRule()])});
  get rules(): FormArray { return this.form.controls.rules; }
  constructor() { this.api.list().subscribe(cards => this.cards.set(cards)); }
  createRule() { return this.fb.nonNullable.group({creditCardId: ['', Validators.required], cashbackRate: ['', Validators.required], monthlyCapAmount: [''], effectiveFrom: [new Date().toISOString().slice(0, 10), Validators.required], effectiveTo: [''], note: ['']}); }
  addRule(): void { this.rules.push(this.createRule()); }
  removeRule(index: number): void { if (this.rules.length > 1) this.rules.removeAt(index); }
  submit(): void { if (this.form.invalid) {this.form.markAllAsTouched(); return;} const value = this.form.getRawValue(); this.saving.set(true); this.api.createMccCategory({mccCode: value.mccCode, categoryName: value.categoryName, description: value.description || null, rules: value.rules.map(rule => ({creditCardId: Number(rule.creditCardId), cashbackRate: Number(String(rule.cashbackRate).replace(',', '.')), monthlyCapAmount: rule.monthlyCapAmount ? parseVndInput(rule.monthlyCapAmount) : null, effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo || null, note: rule.note || null}))}).subscribe({next: () => {this.saving.set(false); this.toast.success('Đã thêm MCC và rule cashback.'); void this.router.navigateByUrl('/bank-card/mcc');}, error: err => {this.saving.set(false); this.toast.error(err?.error?.message ?? 'Không thể thêm MCC.');}}); }
}

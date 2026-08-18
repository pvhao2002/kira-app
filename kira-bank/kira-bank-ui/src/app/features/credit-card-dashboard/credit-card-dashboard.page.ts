import {ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild} from '@angular/core';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {CreditCardDashboard} from '../../shared/models/api.models';
import {CreditCardDebtBank} from '../../shared/models/api.models';
import {ToastService} from '../../core/services/toast.service';
import {finalize} from 'rxjs';
import {
  BankBalanceDialogComponent,
  BankBalanceDialogTarget,
  BankBalanceDialogValue
} from '../../shared/bank-balance-dialog/bank-balance-dialog';
import {IconComponent} from '../../shared/icon/icon';
import {MoneyInputDirective} from '../../shared/money-input/money-input.directive';

@Component({
  selector: 'app-credit-card-dashboard',
  imports: [BankBalanceDialogComponent, IconComponent, MoneyInputDirective],
  templateUrl: './credit-card-dashboard.page.html',
  styleUrl: './credit-card-dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardDashboardPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly i18n = inject(LanguageService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly data = signal<CreditCardDashboard | null>(null);
  readonly expandedBanks = signal<ReadonlySet<number>>(new Set());
  readonly editingLimitBank = signal<CreditCardDebtBank | null>(null);
  readonly limitValue = signal<number | null>(null);
  readonly limitSaving = signal(false);
  readonly limitError = signal('');
  readonly editingBalanceBank = signal<BankBalanceDialogTarget | null>(null);
  readonly balanceSaving = signal(false);
  readonly balanceError = signal('');
  readonly limitInput = viewChild<ElementRef<HTMLInputElement>>('limitInput');
  private limitTrigger: HTMLElement | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.creditCardDashboard().subscribe({
      next: dashboard => {
        this.data.set(dashboard);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  toggleBank(bankId: number): void {
    this.expandedBanks.update(current => {
      const next = new Set(current);
      next.has(bankId) ? next.delete(bankId) : next.add(bankId);
      return next;
    });
  }

  openLimitEditor(bank: CreditCardDebtBank): void {
    this.limitTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.editingLimitBank.set(bank);
    this.limitValue.set(bank.totalCreditLimit);
    this.limitError.set('');
    setTimeout(() => this.limitInput()?.nativeElement.focus());
  }

  closeLimitEditor(): void {
    if (this.limitSaving()) return;
    this.editingLimitBank.set(null);
    this.limitValue.set(null);
    this.limitError.set('');
    const trigger = this.limitTrigger;
    this.limitTrigger = null;
    setTimeout(() => trigger?.focus());
  }

  saveLimit(event: SubmitEvent): void {
    event.preventDefault();
    const bank = this.editingLimitBank();
    const amount = this.limitValue();
    if (!bank || amount === null || !Number.isFinite(amount) || amount <= 0) {
      this.limitError.set(this.i18n.t('form.invalidValue'));
      return;
    }

    this.limitSaving.set(true);
    this.limitError.set('');
    this.api.updateCreditCardBankLimit(bank.bankId, amount, bank.creditLimitVersion)
      .pipe(finalize(() => this.limitSaving.set(false)))
      .subscribe({
        next: () => {
          this.editingLimitBank.set(null);
          this.toast.show(this.i18n.t('form.saved'), 'success');
          this.load();
        },
        error: error => this.limitError.set(error.error?.message ?? this.i18n.t('form.saveFailed'))
      });
  }

  openBalanceEditor(bank: CreditCardDebtBank): void {
    this.balanceError.set('');
    this.editingBalanceBank.set({
      bankId: bank.bankId,
      bankName: bank.bankName,
      remainingBalance: bank.availableCredit,
      creditLimit: bank.totalCreditLimit,
      currency: bank.currency,
      balanceVersion: bank.balanceVersion
    });
  }

  closeBalanceEditor(): void {
    if (this.balanceSaving()) return;
    this.editingBalanceBank.set(null);
    this.balanceError.set('');
  }

  saveBalance(value: BankBalanceDialogValue): void {
    const bank = this.editingBalanceBank();
    if (!bank) return;

    this.balanceSaving.set(true);
    this.balanceError.set('');
    const usedBalance = Number((bank.creditLimit - value.remainingBalance).toFixed(4));
    this.api.updateCreditCardBankBalance(bank.bankId, usedBalance, value.reason, bank.balanceVersion)
      .pipe(finalize(() => this.balanceSaving.set(false)))
      .subscribe({
        next: () => {
          this.editingBalanceBank.set(null);
          this.toast.show(this.i18n.t('form.saved'), 'success');
          this.load();
        },
        error: error => this.balanceError.set(error.error?.message ?? this.i18n.t('form.saveFailed'))
      });
  }

  formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2
    }).format(value);
  }

  formatRate(value: number): string {
    return new Intl.NumberFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  barWidth(rate: number): number {
    return Math.min(Math.max(rate, 0), 100);
  }

  hideBrokenLogo(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.hidden = true;
    image.parentElement?.setAttribute('hidden', '');
  }

  hideMobileLogo(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.hidden = true;
  }
}

import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription, finalize} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {numberFormat} from '../../core/i18n/formatters';
import {apiErrorMessage} from '../../core/services/api-error';
import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {MoneyInputDirective} from '../../shared/money-input/money-input.directive';
import {IconComponent} from '../../shared/icon/icon';
import {
  CardMerchantRule,
  CardTransaction,
  CardTransactionFilter,
  CardTransactionType,
  CreditCardBenefit,
  PageResponse,
  UserCreditCard
} from '../../shared/models/api.models';

const TRANSACTION_TYPES: CardTransactionType[] = ['SPENDING', 'REFUND', 'FEE', 'INTEREST', 'CASHBACK'];
const PAGE_SIZE = 20;

type Tab = 'transactions' | 'rules';

interface TransactionForm {
  cardId: number | null;
  transactionDate: string;
  description: string;
  amount: number | null;
  transactionType: CardTransactionType;
  mccCode: string;
  cashbackRuleId: number | null
}

interface RuleForm {
  id: number | null;
  version: number | null;
  pattern: string;
  mccCode: string;
  label: string;
  applyToExisting: boolean
}

@Component({
  selector: 'app-credit-card-transactions',
  imports: [FormsModule, CustomSelectComponent, MoneyInputDirective, IconComponent],
  templateUrl: './credit-card-transactions.page.html',
  styleUrl: './credit-card-transactions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardTransactionsPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest?: Subscription;

  readonly tab = signal<Tab>(this.route.snapshot.queryParamMap.get('tab') === 'rules' ? 'rules' : 'transactions');
  readonly cards = signal<UserCreditCard[]>([]);
  readonly benefits = signal<CreditCardBenefit[]>([]);
  readonly filter = signal<CardTransactionFilter>({
    cardId: this.numberParam('cardId'), fromDate: null, toDate: null, type: null, q: ''
  });
  readonly page = signal(0);
  readonly result = signal<PageResponse<CardTransaction> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly editing = signal<CardTransaction | null>(null);
  readonly form = signal<TransactionForm | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  private idempotencyKey = '';

  readonly rules = signal<CardMerchantRule[]>([]);
  readonly rulesLoading = signal(false);
  readonly ruleForm = signal<RuleForm | null>(null);
  readonly ruleError = signal<string | null>(null);
  readonly busyRuleId = signal<number | null>(null);

  readonly cardOptions = computed<SelectOption[]>(() => this.cards().map(card => ({
    value: card.id,
    label: `${card.nickname}${card.lastFour ? ' · •••• ' + card.lastFour : ''}`,
    sublabel: card.bankName,
    iconUrl: card.bankLogoUrl ?? undefined
  })));
  readonly filterCardOptions = computed<SelectOption[]>(() =>
    [{value: '', label: this.i18n.t('cardTransactions.allCards')}, ...this.cardOptions()]);
  readonly typeOptions = computed<SelectOption[]>(() => TRANSACTION_TYPES.map(value => ({
    value, label: this.i18n.t(`cardImport.type.${value.toLowerCase()}`)
  })));
  readonly filterTypeOptions = computed<SelectOption[]>(() =>
    [{value: '', label: this.i18n.t('cardTransactions.allTypes')}, ...this.typeOptions()]);
  readonly formCategoryOptions = computed<SelectOption[]>(() => {
    const cardId = this.form()?.cardId;
    const options: SelectOption[] = [{value: '', label: this.i18n.t('cardImport.noCategory')}];
    this.benefits().find(item => item.cardId === cardId)?.programs.filter(program => program.active)
      .forEach(program => program.groups.forEach(group =>
        options.push({value: group.id, label: group.categoryName, sublabel: program.name})));
    return options;
  });
  readonly totalPages = computed(() => this.result()?.meta.totalPages ?? 0);

  constructor() {
    this.api.page<UserCreditCard>('credit-cards', 0, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => this.cards.set(response.data),
      error: error => this.error.set(apiErrorMessage(error, this.i18n.t('cardImport.errorCards')))
    });
    this.api.creditCardBenefits().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: benefits => this.benefits.set(benefits),
      error: () => this.benefits.set([])
    });
    this.load();
    this.loadRules();
    this.destroyRef.onDestroy(() => this.listRequest?.unsubscribe());
  }

  switchTab(tab: Tab): void {
    this.tab.set(tab);
    void this.router.navigate([], {relativeTo: this.route, queryParams: {tab: tab === 'rules' ? 'rules' : null},
      queryParamsHandling: 'merge', replaceUrl: true});
  }

  updateFilter(patch: Partial<CardTransactionFilter>): void {
    this.filter.update(filter => ({...filter, ...patch}));
  }

  chooseFilterCard(value: number | string): void {
    this.updateFilter({cardId: value === '' ? null : Number(value)});
    this.applyFilter();
  }

  chooseFilterType(value: string): void {
    this.updateFilter({type: value === '' ? null : value as CardTransactionType});
    this.applyFilter();
  }

  applyFilter(): void {
    const filter = this.filter();
    if (filter.fromDate && filter.toDate && filter.toDate < filter.fromDate) {
      this.error.set(this.i18n.t('cardTransactions.invalidRange'));
      return;
    }
    this.page.set(0);
    this.load();
  }

  resetFilter(): void {
    this.filter.set({cardId: null, fromDate: null, toDate: null, type: null, q: ''});
    this.applyFilter();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.listRequest = this.api.searchCardTransactions(this.filter(), this.page(), PAGE_SIZE)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: result => this.result.set(result),
        error: error => this.error.set(apiErrorMessage(error, this.i18n.t('cardTransactions.loadError')))
      });
  }

  openCreate(): void {
    const cardId = this.filter().cardId ?? this.cards()[0]?.id ?? null;
    this.editing.set(null);
    this.idempotencyKey = crypto.randomUUID();
    this.formError.set(null);
    this.form.set({
      cardId, transactionDate: this.today(), description: '', amount: null, transactionType: 'SPENDING',
      mccCode: '', cashbackRuleId: null
    });
  }

  openEdit(transaction: CardTransaction): void {
    this.editing.set(transaction);
    this.formError.set(null);
    this.form.set({
      cardId: transaction.cardId,
      transactionDate: transaction.transactionDate,
      description: transaction.description,
      amount: transaction.amount,
      transactionType: transaction.transactionType,
      mccCode: transaction.mccCode ?? '',
      cashbackRuleId: transaction.cashbackRuleId
    });
  }

  closeForm(): void {
    if (this.saving()) return;
    this.form.set(null);
    this.editing.set(null);
  }

  updateForm(patch: Partial<TransactionForm>): void {
    this.form.update(form => form ? {...form, ...patch} : form);
  }

  chooseFormCard(value: number | string): void {
    this.updateForm({cardId: Number(value), cashbackRuleId: null});
  }

  chooseFormCategory(value: number | string): void {
    const id = Number(value);
    this.updateForm({cashbackRuleId: value === '' || !Number.isFinite(id) ? null : id});
  }

  formCategoryValue(): number | string {
    return this.form()?.cashbackRuleId ?? '';
  }

  save(): void {
    const form = this.form();
    if (!form || this.saving()) return;
    const validation = this.validate(form);
    this.formError.set(validation);
    if (validation) return;
    const request = {
      transactionDate: form.transactionDate,
      description: form.description.trim(),
      amount: form.amount!,
      transactionType: form.transactionType,
      mccCode: form.mccCode.trim() || null,
      cashbackRuleId: form.cashbackRuleId
    };
    const editing = this.editing();
    const call = editing
      ? this.api.updateCardTransaction(editing.id, {...request, version: editing.version})
      : this.api.createCardTransaction(form.cardId!, request, this.idempotencyKey);
    this.saving.set(true);
    call.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.toast.show(this.i18n.t(editing ? 'cardTransactions.updated' : 'cardTransactions.created'), 'success');
        this.form.set(null);
        this.editing.set(null);
        this.load();
      },
      error: error => this.formError.set(apiErrorMessage(error, this.i18n.t('cardTransactions.saveError')))
    });
  }

  remove(transaction: CardTransaction): void {
    if (!confirm(this.i18n.t('creditBenefits.deleteTransactionConfirm', {description: transaction.description}))) return;
    this.api.deleteCardTransaction(transaction.id, transaction.version).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('creditBenefits.transactionDeleted'), 'success');
        this.load();
      },
      error: error => this.error.set(apiErrorMessage(error, this.i18n.t('creditBenefits.deleteFailed')))
    });
  }

  rememberFrom(transaction: CardTransaction): void {
    this.switchTab('rules');
    this.openRule(null, {
      pattern: transaction.description.toLowerCase().replace(/\s+/g, ' ').trim().split(/[0-9*#]/)[0].trim().slice(0, 40),
      mccCode: transaction.mccCode ?? ''
    });
  }

  loadRules(): void {
    this.rulesLoading.set(true);
    this.api.cardMerchantRules().pipe(finalize(() => this.rulesLoading.set(false))).subscribe({
      next: rules => this.rules.set(rules),
      error: error => this.ruleError.set(apiErrorMessage(error, this.i18n.t('cardTransactions.rulesLoadError')))
    });
  }

  openRule(rule: CardMerchantRule | null, preset: Partial<RuleForm> = {}): void {
    this.ruleError.set(null);
    this.ruleForm.set({
      id: rule?.id ?? null,
      version: rule?.version ?? null,
      pattern: rule?.pattern ?? '',
      mccCode: rule?.mccCode ?? '',
      label: rule?.label ?? '',
      applyToExisting: rule === null,
      ...preset
    });
  }

  updateRuleForm(patch: Partial<RuleForm>): void {
    this.ruleForm.update(form => form ? {...form, ...patch} : form);
  }

  saveRule(): void {
    const form = this.ruleForm();
    if (!form || this.busyRuleId() !== null) return;
    const pattern = form.pattern.trim();
    if (pattern.length < 2 || pattern.length > 100 || !/^\d{4}$/.test(form.mccCode.trim())) {
      this.ruleError.set(this.i18n.t('cardTransactions.ruleInvalid'));
      return;
    }
    const request = {pattern, mccCode: form.mccCode.trim(), label: form.label.trim() || null,
      applyToExisting: form.applyToExisting, version: form.version};
    this.busyRuleId.set(form.id ?? 0);
    if (form.id === null) {
      this.api.createCardMerchantRule(request).pipe(finalize(() => this.busyRuleId.set(null))).subscribe({
        next: result => {
          this.toast.show(this.i18n.t('cardTransactions.ruleCreated', {count: result.updatedTransactions}), 'success');
          this.ruleForm.set(null);
          this.loadRules();
          if (result.updatedTransactions) this.load();
        },
        error: error => this.ruleError.set(apiErrorMessage(error, this.i18n.t('cardTransactions.ruleSaveError')))
      });
    } else {
      this.api.updateCardMerchantRule(form.id, request).pipe(finalize(() => this.busyRuleId.set(null))).subscribe({
        next: () => {
          this.toast.show(this.i18n.t('cardTransactions.ruleUpdated'), 'success');
          this.ruleForm.set(null);
          this.loadRules();
        },
        error: error => this.ruleError.set(apiErrorMessage(error, this.i18n.t('cardTransactions.ruleSaveError')))
      });
    }
  }

  deleteRule(rule: CardMerchantRule): void {
    if (this.busyRuleId() !== null || !confirm(this.i18n.t('cardTransactions.ruleDeleteConfirm', {pattern: rule.pattern}))) return;
    this.busyRuleId.set(rule.id);
    this.api.deleteCardMerchantRule(rule.id, rule.version).pipe(finalize(() => this.busyRuleId.set(null))).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('cardTransactions.ruleDeleted'), 'success');
        this.loadRules();
      },
      error: error => this.ruleError.set(apiErrorMessage(error, this.i18n.t('cardTransactions.ruleSaveError')))
    });
  }

  typeLabel(type: CardTransactionType): string {
    return this.i18n.t(`cardImport.type.${type.toLowerCase()}`);
  }

  formatMoney(value: number, currency: string): string {
    return numberFormat(this.i18n.locale(), {
      style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2
    }).format(value);
  }

  private validate(form: TransactionForm): string | null {
    if (!form.cardId) return this.i18n.t('cardTransactions.validation.card');
    if (!form.transactionDate) return this.i18n.t('cardTransactions.validation.date');
    if (!form.description.trim()) return this.i18n.t('cardTransactions.validation.description');
    if (form.amount === null || form.amount <= 0) return this.i18n.t('cardTransactions.validation.amount');
    if (form.mccCode.trim() && !/^\d{4}$/.test(form.mccCode.trim())) return this.i18n.t('cardRecommend.invalidMcc');
    return null;
  }

  private numberParam(name: string): number | null {
    const value = Number(this.route.snapshot.queryParamMap.get(name));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

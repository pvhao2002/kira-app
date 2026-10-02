import {ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Subscription, timer} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {numberFormat} from '../../core/i18n/formatters';
import {apiErrorMessage} from '../../core/services/api-error';
import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {MoneyInputDirective} from '../../shared/money-input/money-input.directive';
import {IconComponent} from '../../shared/icon/icon';
import {
  CardStatementConfirmRequest,
  CardStatementConfirmResponse,
  CardStatementImport,
  CardTransactionType,
  CreditCardBenefit,
  UserCreditCard
} from '../../shared/models/api.models';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TRANSACTION_TYPES: CardTransactionType[] = ['SPENDING', 'REFUND', 'FEE', 'INTEREST', 'CASHBACK'];

interface ReviewRow {
  lineNumber: number;
  include: boolean;
  transactionDate: string;
  postingDate: string | null;
  description: string;
  amount: number | null;
  transactionType: CardTransactionType | null;
  mccCode: string;
  cashbackRuleId: number | null;
  duplicate: boolean;
  needsReview: boolean;
  merchantRuleApplied: boolean;
  remember: boolean;
  rememberPattern: string;
  warnings: string[]
}

interface SourcePage {
  attachmentId: number;
  pageNumber: number;
  url: string | null;
  failed: boolean
}

interface TotalsForm {
  statementDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number | null;
  totalSpending: number | null;
  totalRefund: number | null;
  totalFee: number | null;
  totalInterest: number | null;
  statementBalance: number | null;
  minimumPayment: number | null
}

@Component({
  selector: 'app-credit-card-statement-import',
  imports: [FormsModule, RouterLink, CustomSelectComponent, MoneyInputDirective, IconComponent],
  templateUrl: './credit-card-statement-import.page.html',
  styleUrl: './credit-card-statement-import.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardStatementImportPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private polling?: Subscription;

  readonly cards = signal<UserCreditCard[]>([]);
  readonly cardId = signal<number | null>(null);
  readonly benefits = signal<CreditCardBenefit[]>([]);
  readonly recentImports = signal<CardStatementImport[]>([]);
  readonly selectedFiles = signal<File[]>([]);
  readonly current = signal<CardStatementImport | null>(null);
  readonly rows = signal<ReviewRow[]>([]);
  readonly totals = signal<TotalsForm | null>(null);
  readonly result = signal<CardStatementConfirmResponse | null>(null);
  readonly loadingCards = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly sourcePages = signal<SourcePage[]>([]);
  readonly activePage = signal(0);
  readonly zoomed = signal(false);
  private sourceImportId: number | null = null;
  private sourceRequests: Subscription[] = [];

  readonly selectedCard = computed(() => this.cards().find(card => card.id === this.cardId()) ?? null);
  readonly cardOptions = computed<SelectOption[]>(() => this.cards().map(card => ({
    value: card.id,
    label: `${card.nickname}${card.lastFour ? ' · •••• ' + card.lastFour : ''}`,
    sublabel: card.bankName,
    iconUrl: card.bankLogoUrl ?? undefined
  })));
  readonly typeOptions = computed<SelectOption[]>(() => TRANSACTION_TYPES.map(value => ({
    value, label: this.i18n.t(`cardImport.type.${value.toLowerCase()}`)
  })));
  readonly categoryOptions = computed<SelectOption[]>(() => {
    const benefit = this.benefits().find(item => item.cardId === this.cardId());
    const options: SelectOption[] = [{value: '', label: this.i18n.t('cardImport.noCategory')}];
    benefit?.programs.filter(program => program.active).forEach(program => program.groups.forEach(group =>
      options.push({value: group.id, label: group.categoryName, sublabel: program.name})));
    return options;
  });
  /** MCC codes of each cashback group of the selected card, used to pre-fill MCC when a group is chosen. */
  private readonly groupMccs = computed(() => {
    const map = new Map<number, string[]>();
    this.benefits().find(item => item.cardId === this.cardId())?.programs
      .forEach(program => program.groups.forEach(group => map.set(group.id, group.mccCodes)));
    return map;
  });
  readonly waiting = computed(() => ['QUEUED', 'PROCESSING'].includes(this.current()?.status ?? ''));
  readonly canReview = computed(() => this.current()?.status === 'READY' && !!this.totals());
  readonly includedCount = computed(() => this.rows().filter(row => row.include).length);

  constructor() {
    const requestedCardId = Number(this.route.snapshot.queryParamMap.get('cardId'));
    const requestedImportId = Number(this.route.snapshot.queryParamMap.get('importId'));
    this.api.page<UserCreditCard>('credit-cards', 0, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.cards.set(response.data);
        this.loadingCards.set(false);
        if (Number.isFinite(requestedImportId) && requestedImportId > 0) {
          this.openImport(requestedImportId);
        } else if (response.data.length) {
          const requested = response.data.find(card => card.id === requestedCardId);
          this.selectCard((requested ?? response.data[0]).id, false);
        }
      },
      error: error => {
        this.loadingCards.set(false);
        this.error.set(apiErrorMessage(error, this.i18n.t('cardImport.errorCards')));
      }
    });
    this.api.creditCardBenefits().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: benefits => this.benefits.set(benefits),
      error: () => this.benefits.set([])
    });
    this.destroyRef.onDestroy(() => {
      this.polling?.unsubscribe();
      this.clearSource();
    });
  }

  chooseCard(value: number | string): void {
    const id = Number(value);
    if (Number.isFinite(id)) this.selectCard(id, true);
  }

  chooseFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  dropFiles(event: DragEvent): void {
    event.preventDefault();
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  @HostListener('document:paste', ['$event'])
  pasteImages(event: ClipboardEvent): void {
    const images = Array.from(event.clipboardData?.items ?? [])
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null)
      .map((file, index) => new File([file], `statement-${Date.now()}-${index + 1}.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'}`,
        {type: file.type, lastModified: Date.now()}));
    if (!images.length) return;
    event.preventDefault();
    this.addFiles(images);
  }

  removeFile(index: number): void {
    this.selectedFiles.update(files => files.filter((_, current) => current !== index));
  }

  upload(): void {
    const cardId = this.cardId();
    if (!cardId || !this.selectedFiles().length || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    this.api.createCardStatementImport(cardId, this.selectedFiles()).subscribe({
      next: statementImport => {
        this.busy.set(false);
        this.selectedFiles.set([]);
        this.applyImport(statementImport);
        this.updateUrl(cardId, statementImport.id);
        this.loadRecent(cardId);
        this.startPolling(statementImport.id);
      },
      error: error => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error, this.i18n.t('cardImport.errorUpload')));
      }
    });
  }

  openImport(id: number): void {
    this.polling?.unsubscribe();
    this.error.set(null);
    this.result.set(null);
    this.api.cardStatementImport(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: statementImport => {
        if (this.cardId() !== statementImport.cardId) {
          this.cardId.set(statementImport.cardId);
          this.loadRecent(statementImport.cardId);
        }
        this.applyImport(statementImport);
        this.updateUrl(statementImport.cardId, statementImport.id);
        if (this.waiting()) this.startPolling(statementImport.id);
      },
      error: error => this.error.set(apiErrorMessage(error, this.i18n.t('cardImport.errorLoad')))
    });
  }

  retry(): void {
    const statementImport = this.current();
    if (!statementImport || this.busy()) return;
    this.busy.set(true);
    this.api.retryCardStatementImport(statementImport.id, statementImport.version).subscribe({
      next: updated => {
        this.busy.set(false);
        this.applyImport(updated);
        this.startPolling(updated.id);
      },
      error: error => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error, this.i18n.t('cardImport.errorRetry')));
      }
    });
  }

  cancel(): void {
    const statementImport = this.current();
    if (!statementImport || this.busy()) return;
    this.busy.set(true);
    this.api.cancelCardStatementImport(statementImport.id, statementImport.version).subscribe({
      next: updated => {
        this.busy.set(false);
        this.applyImport(updated);
        this.loadRecent(updated.cardId);
      },
      error: error => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error, this.i18n.t('cardImport.errorCancel')));
      }
    });
  }

  updateTotals(patch: Partial<TotalsForm>): void {
    this.totals.update(totals => totals ? {...totals, ...patch} : totals);
  }

  updateRow(row: ReviewRow, patch: Partial<ReviewRow>): void {
    this.rows.update(rows => rows.map(item => item.lineNumber === row.lineNumber ? {...item, ...patch} : item));
  }

  toggleAll(include: boolean): void {
    this.rows.update(rows => rows.map(row => ({...row, include})));
  }

  confirm(): void {
    const statementImport = this.current();
    const totals = this.totals();
    if (!statementImport || !totals || this.busy()) return;
    const validation = this.validate(totals);
    this.formError.set(validation);
    if (validation) return;
    const request: CardStatementConfirmRequest = {
      version: statementImport.version,
      statementDate: totals.statementDate,
      dueDate: totals.dueDate,
      periodStart: totals.periodStart || null,
      periodEnd: totals.periodEnd || null,
      openingBalance: totals.openingBalance,
      totalSpending: totals.totalSpending,
      totalRefund: totals.totalRefund,
      totalFee: totals.totalFee,
      totalInterest: totals.totalInterest,
      statementBalance: totals.statementBalance!,
      minimumPayment: totals.statementBalance === 0 ? 0 : totals.minimumPayment!,
      transactions: this.rows()
        .filter(row => row.include || this.rowComplete(row))
        .map(row => ({
          include: row.include,
          transactionDate: row.transactionDate,
          postingDate: row.postingDate || null,
          description: row.description.trim(),
          amount: row.amount!,
          transactionType: row.transactionType!,
          mccCode: row.mccCode.trim() || null,
          cashbackRuleId: row.cashbackRuleId,
          rememberPattern: row.include && row.remember && row.mccCode.trim() ? row.rememberPattern.trim() : null
        }))
    };
    this.busy.set(true);
    this.api.confirmCardStatementImport(statementImport.id, request).subscribe({
      next: result => {
        this.busy.set(false);
        this.result.set(result);
        this.toast.show(this.i18n.t('cardImport.confirmed', {count: result.inserted}), 'success');
        this.openImport(statementImport.id);
        this.loadRecent(statementImport.cardId);
      },
      error: error => {
        this.busy.set(false);
        this.formError.set(apiErrorMessage(error, this.i18n.t('cardImport.errorConfirm')));
      }
    });
  }

  statusLabel(status: string): string {
    return this.i18n.t(`cardImport.status.${status.toLowerCase()}`);
  }

  warningLabel(code: string): string {
    const key = `cardImport.warning.${code}`;
    return this.i18n.has(key) ? this.i18n.t(key) : code;
  }

  formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return numberFormat(this.i18n.locale(), {maximumFractionDigits: 4}).format(value);
  }

  categoryValue(row: ReviewRow): number | string {
    return row.cashbackRuleId ?? '';
  }

  chooseCategory(row: ReviewRow, value: number | string): void {
    const id = Number(value);
    const ruleId = value === '' || !Number.isFinite(id) ? null : id;
    const patch: Partial<ReviewRow> = {cashbackRuleId: ruleId};
    // A remembered merchant needs an MCC; take the group's first one when the row has none yet.
    if (ruleId !== null && !row.mccCode.trim()) patch.mccCode = this.groupMccs().get(ruleId)?.[0] ?? '';
    this.updateRow(row, patch);
  }

  toggleRemember(row: ReviewRow, remember: boolean): void {
    this.updateRow(row, {remember, rememberPattern: row.rememberPattern || this.suggestPattern(row.description)});
  }

  showPage(index: number): void {
    this.activePage.set(index);
    this.zoomed.set(false);
  }

  private selectCard(id: number, updateUrl: boolean): void {
    this.polling?.unsubscribe();
    this.clearSource();
    this.cardId.set(id);
    this.current.set(null);
    this.rows.set([]);
    this.totals.set(null);
    this.result.set(null);
    this.selectedFiles.set([]);
    this.loadRecent(id);
    if (updateUrl) {
      this.error.set(null);
      this.updateUrl(id, null);
    }
  }

  private loadRecent(cardId: number): void {
    this.api.cardStatementImports(cardId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: imports => this.recentImports.set(imports),
      error: () => this.recentImports.set([])
    });
  }

  private addFiles(incoming: File[]): void {
    const combined = [...this.selectedFiles(), ...incoming];
    if (combined.length > MAX_FILES) {
      this.error.set(this.i18n.t('cardImport.errorTooManyFiles', {max: MAX_FILES}));
      return;
    }
    if (combined.some(file => file.size === 0 || file.size > MAX_FILE_SIZE || !IMAGE_TYPES.has(file.type))) {
      this.error.set(this.i18n.t('cardImport.errorInvalidFiles'));
      return;
    }
    this.error.set(null);
    this.selectedFiles.set(combined);
  }

  private startPolling(id: number): void {
    this.polling?.unsubscribe();
    this.polling = timer(3000, 5000).pipe(
      switchMap(() => this.api.cardStatementImport(id)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: statementImport => {
        this.applyImport(statementImport);
        if (!this.waiting()) {
          this.polling?.unsubscribe();
          this.loadRecent(statementImport.cardId);
        }
      },
      error: () => {
        this.polling?.unsubscribe();
        this.error.set(this.i18n.t('cardImport.errorPolling'));
      }
    });
  }

  private applyImport(statementImport: CardStatementImport): void {
    const previous = this.current();
    this.current.set(statementImport);
    this.loadSource(statementImport);
    if (statementImport.result) this.result.set(statementImport.result);
    const draft = statementImport.draft;
    const sameDraft = previous?.id === statementImport.id && previous.status === statementImport.status && !!this.totals();
    if (!draft || statementImport.status !== 'READY') {
      this.totals.set(null);
      this.rows.set([]);
      return;
    }
    if (sameDraft) return;
    this.formError.set(null);
    this.totals.set({
      statementDate: draft.statementDate ?? '',
      dueDate: draft.dueDate ?? '',
      periodStart: draft.periodStart ?? '',
      periodEnd: draft.periodEnd ?? '',
      openingBalance: draft.openingBalance,
      totalSpending: draft.totalSpending,
      totalRefund: draft.totalRefund,
      totalFee: draft.totalFee,
      totalInterest: draft.totalInterest,
      statementBalance: draft.statementBalance,
      minimumPayment: draft.minimumPayment
    });
    this.rows.set(draft.transactions.map(row => ({
      lineNumber: row.lineNumber,
      include: !row.duplicate,
      transactionDate: row.transactionDate ?? '',
      postingDate: row.postingDate,
      description: row.description ?? '',
      amount: row.amount,
      transactionType: row.transactionType,
      mccCode: row.mccCode ?? '',
      cashbackRuleId: row.cashbackRuleId,
      duplicate: row.duplicate,
      needsReview: row.needsReview,
      merchantRuleApplied: row.merchantRuleApplied,
      remember: false,
      rememberPattern: '',
      warnings: row.warnings
    })));
  }

  private rowComplete(row: ReviewRow): boolean {
    return !!row.transactionDate && !!row.description.trim() && row.amount !== null && row.amount > 0
      && row.transactionType !== null && (!row.mccCode.trim() || /^\d{4}$/.test(row.mccCode.trim()));
  }

  private validate(totals: TotalsForm): string | null {
    if (!totals.statementDate || !totals.dueDate) return this.i18n.t('cardImport.validation.dates');
    if (totals.dueDate < totals.statementDate) return this.i18n.t('cardImport.validation.dueBeforeStatement');
    if (totals.periodStart && totals.periodEnd && totals.periodEnd < totals.periodStart)
      return this.i18n.t('cardImport.validation.period');
    if (totals.statementBalance === null || totals.statementBalance < 0)
      return this.i18n.t('cardImport.validation.balance');
    if (totals.statementBalance > 0 && (totals.minimumPayment === null || totals.minimumPayment <= 0))
      return this.i18n.t('cardImport.validation.minimumRequired');
    if (totals.minimumPayment !== null && totals.minimumPayment > totals.statementBalance)
      return this.i18n.t('cardImport.validation.minimumExceeds');
    const invalid = this.rows().find(row => row.include && !this.rowComplete(row));
    if (invalid) return this.i18n.t('cardImport.validation.row', {line: invalid.lineNumber});
    const badRemember = this.rows().find(row => row.include && row.remember
      && (!row.mccCode.trim() || row.rememberPattern.trim().length < 2 || row.rememberPattern.trim().length > 100));
    if (badRemember) return this.i18n.t('cardImport.validation.remember', {line: badRemember.lineNumber});
    return null;
  }

  /** Loads the statement pages once per import so the user can compare the draft with the original. */
  private loadSource(statementImport: CardStatementImport): void {
    if (this.sourceImportId === statementImport.id) return;
    this.clearSource();
    this.sourceImportId = statementImport.id;
    const pages = statementImport.files.map(file => ({
      attachmentId: file.attachmentId, pageNumber: file.pageNumber, url: null, failed: statementImport.storagePurged
    }));
    this.sourcePages.set(pages);
    if (statementImport.storagePurged) return;
    this.sourceRequests = pages.map(page => this.api.attachmentContent(page.attachmentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        if (this.sourceImportId !== statementImport.id) {
          URL.revokeObjectURL(url);
          return;
        }
        this.sourcePages.update(items => items.map(item =>
          item.attachmentId === page.attachmentId ? {...item, url} : item));
      },
      error: () => this.sourcePages.update(items => items.map(item =>
        item.attachmentId === page.attachmentId ? {...item, failed: true} : item))
    }));
  }

  private clearSource(): void {
    this.sourceRequests.forEach(request => request.unsubscribe());
    this.sourceRequests = [];
    this.sourcePages().forEach(page => {
      if (page.url) URL.revokeObjectURL(page.url);
    });
    this.sourcePages.set([]);
    this.activePage.set(0);
    this.zoomed.set(false);
    this.sourceImportId = null;
  }

  /**
   * Merchant keyword suggestion. It must stay a contiguous piece of the normalized description (lower-case, single
   * spaces) because the backend matches rules with "contains": cut at the first digit or reference symbol and keep
   * the first three words.
   */
  private suggestPattern(description: string): string {
    const normalized = description.toLowerCase().replace(/\s+/g, ' ').trim();
    const cut = normalized.search(/[0-9*#]/);
    return (cut > 0 ? normalized.slice(0, cut) : normalized)
      .trim()
      .split(' ')
      .slice(0, 3)
      .join(' ')
      .slice(0, 40)
      .replace(/[\s\-.,:/_]+$/, '');
  }

  private updateUrl(cardId: number, importId: number | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {cardId, importId},
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}

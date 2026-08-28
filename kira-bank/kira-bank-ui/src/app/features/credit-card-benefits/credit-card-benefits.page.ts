import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {finalize} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {IconComponent} from '../../shared/icon/icon';
import {MoneyInputDirective} from '../../shared/money-input/money-input.directive';
import {
  ApiError,
  CreditCardBenefit,
  CreditCardCashbackGroup,
  CreditCardCashbackProgram,
  CreditCardCashbackProgramRequest
} from '../../shared/models/api.models';

interface GroupDraft {
  id: number | null;
  version: number | null;
  categoryName: string;
  cashbackRate: number | null;
  maxCashbackAmount: number | null;
  mccCodes: string[];
  mccInput: string
}

interface ProgramDraft {
  id: number | null;
  version: number | null;
  name: string;
  notes: string;
  termsUrl: string;
  active: boolean;
  groups: GroupDraft[]
}

@Component({
  selector: 'app-credit-card-benefits',
  imports: [FormsModule, IconComponent, MoneyInputDirective],
  templateUrl: './credit-card-benefits.page.html',
  styleUrl: './credit-card-benefits.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardBenefitsPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);

  readonly cards = signal<CreditCardBenefit[]>([]);
  readonly selectedCardId = signal<number | null>(null);
  readonly selectedCard = computed(() => this.cards().find(card => card.cardId === this.selectedCardId()) ?? null);
  readonly loading = signal(true);
  readonly savingCap = signal(false);
  readonly savingProgram = signal(false);
  readonly togglingProgramId = signal<number | null>(null);
  readonly pageError = signal('');
  readonly formError = signal('');
  readonly monthlyCap = signal<number | null>(null);
  readonly dialogOpen = signal(false);
  readonly programDraft = signal<ProgramDraft | null>(null);

  constructor() {
    this.load();
  }

  load(preserveCardId = this.selectedCardId()): void {
    this.loading.set(true);
    this.pageError.set('');
    this.api.creditCardBenefits().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: cards => {
        this.cards.set(cards);
        const selected = cards.find(card => card.cardId === preserveCardId) ?? cards[0] ?? null;
        this.selectedCardId.set(selected?.cardId ?? null);
        this.monthlyCap.set(selected?.monthlyCashbackCap ?? null);
      },
      error: error => this.pageError.set(this.errorMessage(error, 'creditBenefits.loadFailed'))
    });
  }

  selectCard(value: string): void {
    const id = Number(value);
    const card = this.cards().find(item => item.cardId === id) ?? null;
    this.selectedCardId.set(card?.cardId ?? null);
    this.monthlyCap.set(card?.monthlyCashbackCap ?? null);
    this.pageError.set('');
  }

  saveMonthlyCap(): void {
    const card = this.selectedCard();
    const amount = Number(this.monthlyCap());
    if (!card || !Number.isFinite(amount) || amount <= 0) {
      this.pageError.set(this.i18n.t('creditBenefits.capInvalid'));
      return;
    }
    this.savingCap.set(true);
    this.pageError.set('');
    this.api.updateCreditCardMonthlyCashbackCap(card.cardId, amount, card.configVersion)
      .pipe(finalize(() => this.savingCap.set(false))).subscribe({
      next: updated => {
        this.applyCard(updated);
        this.toast.show(this.i18n.t('creditBenefits.capSaved'), 'success');
      },
      error: error => this.pageError.set(this.errorMessage(error, 'creditBenefits.saveFailed'))
    });
  }

  openCreateProgram(): void {
    this.programDraft.set({
      id: null, version: null, name: '', notes: '', termsUrl: '', active: true, groups: [this.emptyGroup()]
    });
    this.formError.set('');
    this.dialogOpen.set(true);
  }

  openEditProgram(program: CreditCardCashbackProgram): void {
    this.programDraft.set({
      id: program.id,
      version: program.version,
      name: program.name,
      notes: program.notes ?? '',
      termsUrl: program.termsUrl ?? '',
      active: program.active,
      groups: program.groups.map(group => this.groupDraft(group))
    });
    this.formError.set('');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.savingProgram()) return;
    this.dialogOpen.set(false);
    this.programDraft.set(null);
    this.formError.set('');
  }

  addGroup(): void {
    this.programDraft.update(draft => draft ? {...draft, groups: [...draft.groups, this.emptyGroup()]} : null);
  }

  removeGroup(index: number): void {
    this.programDraft.update(draft => draft
      ? {...draft, groups: draft.groups.filter((_, current) => current !== index)} : null);
  }

  addMcc(group: GroupDraft, event?: Event): void {
    event?.preventDefault();
    const codes = group.mccInput.trim().split(/[\s,;]+/).filter(Boolean);
    if (!codes.length) return;
    const invalidCode = codes.find(code => !/^\d{4}$/.test(code));
    if (invalidCode) {
      this.formError.set(this.i18n.t('creditBenefits.mccInvalid'));
      return;
    }
    const duplicate = codes.find((code, index) => codes.indexOf(code) !== index)
      ?? codes.find(code => this.programDraft()?.groups.some(item => item.mccCodes.includes(code)));
    if (duplicate) {
      this.formError.set(this.i18n.t('creditBenefits.mccDuplicate', {code: duplicate}));
      return;
    }
    group.mccCodes = [...group.mccCodes, ...codes].sort();
    group.mccInput = '';
    this.formError.set('');
    this.touchDraft();
  }

  removeMcc(group: GroupDraft, code: string): void {
    group.mccCodes = group.mccCodes.filter(value => value !== code);
    this.touchDraft();
  }

  saveProgram(): void {
    const card = this.selectedCard();
    const draft = this.programDraft();
    if (!card || !draft) return;
    for (const group of draft.groups) {
      if (group.mccInput.trim()) this.addMcc(group);
    }
    const validation = this.validateDraft(draft);
    if (validation) {
      this.formError.set(validation);
      return;
    }
    const request = this.request(draft);
    const request$ = draft.id === null
      ? this.api.createCreditCardCashbackProgram(card.cardId, request)
      : this.api.updateCreditCardCashbackProgram(card.cardId, draft.id, request);
    this.savingProgram.set(true);
    this.formError.set('');
    request$.pipe(finalize(() => this.savingProgram.set(false))).subscribe({
      next: updated => {
        this.applyCard(updated);
        this.dialogOpen.set(false);
        this.programDraft.set(null);
        this.toast.show(this.i18n.t('creditBenefits.programSaved'), 'success');
      },
      error: error => this.formError.set(this.errorMessage(error, 'creditBenefits.saveFailed'))
    });
  }

  toggleProgram(program: CreditCardCashbackProgram): void {
    const card = this.selectedCard();
    if (!card || this.togglingProgramId()) return;
    const request: CreditCardCashbackProgramRequest = {
      name: program.name,
      notes: program.notes,
      termsUrl: program.termsUrl,
      active: !program.active,
      version: program.version,
      groups: program.groups.map(group => ({
        id: group.id, version: group.version, categoryName: group.categoryName,
        cashbackRate: group.cashbackRate, maxCashbackAmount: group.maxCashbackAmount,
        mccCodes: [...group.mccCodes]
      }))
    };
    this.togglingProgramId.set(program.id);
    this.pageError.set('');
    this.api.updateCreditCardCashbackProgram(card.cardId, program.id, request)
      .pipe(finalize(() => this.togglingProgramId.set(null))).subscribe({
      next: updated => this.applyCard(updated),
      error: error => this.pageError.set(this.errorMessage(error, 'creditBenefits.saveFailed'))
    });
  }

  deleteProgram(program: CreditCardCashbackProgram): void {
    const card = this.selectedCard();
    if (!card || !confirm(this.i18n.t('creditBenefits.deleteConfirm', {name: program.name}))) return;
    this.api.deleteCreditCardCashbackProgram(card.cardId, program.id, program.version).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('creditBenefits.programDeleted'), 'success');
        this.load(card.cardId);
      },
      error: error => this.pageError.set(this.errorMessage(error, 'creditBenefits.deleteFailed'))
    });
  }

  formatMoney(value: number | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US', {
      maximumFractionDigits: 4
    }).format(value);
  }

  private applyCard(updated: CreditCardBenefit): void {
    this.cards.update(cards => cards.map(card => card.cardId === updated.cardId ? updated : card));
    this.monthlyCap.set(updated.monthlyCashbackCap);
    this.pageError.set('');
  }

  private emptyGroup(): GroupDraft {
    return {id: null, version: null, categoryName: '', cashbackRate: null,
      maxCashbackAmount: null, mccCodes: [], mccInput: ''};
  }

  private groupDraft(group: CreditCardCashbackGroup): GroupDraft {
    return {...group, mccCodes: [...group.mccCodes], mccInput: ''};
  }

  private touchDraft(): void {
    this.programDraft.update(draft => draft ? {...draft, groups: [...draft.groups]} : null);
  }

  private validateDraft(draft: ProgramDraft): string {
    if (!draft.name.trim()) return this.i18n.t('creditBenefits.nameRequired');
    if (draft.notes.length > 2000) return this.i18n.t('creditBenefits.notesInvalid');
    if (draft.termsUrl.trim()) {
      try {
        const url = new URL(draft.termsUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) return this.i18n.t('creditBenefits.urlInvalid');
      } catch {
        return this.i18n.t('creditBenefits.urlInvalid');
      }
    }
    if (!draft.groups.length) return this.i18n.t('creditBenefits.groupRequired');
    const names = new Set<string>();
    const mccs = new Set<string>();
    for (const group of draft.groups) {
      const name = group.categoryName.trim().toLocaleLowerCase();
      if (!name) return this.i18n.t('creditBenefits.groupNameRequired');
      if (names.has(name)) return this.i18n.t('creditBenefits.groupDuplicate');
      names.add(name);
      const rate = Number(group.cashbackRate);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return this.i18n.t('creditBenefits.rateInvalid');
      const cap = Number(group.maxCashbackAmount);
      if (!Number.isFinite(cap) || cap <= 0) return this.i18n.t('creditBenefits.groupCapInvalid');
      if (!group.mccCodes.length) return this.i18n.t('creditBenefits.mccRequired');
      for (const code of group.mccCodes) {
        if (!/^\d{4}$/.test(code)) return this.i18n.t('creditBenefits.mccInvalid');
        if (mccs.has(code)) return this.i18n.t('creditBenefits.mccDuplicate', {code});
        mccs.add(code);
      }
    }
    return '';
  }

  private request(draft: ProgramDraft): CreditCardCashbackProgramRequest {
    return {
      name: draft.name.trim(),
      notes: draft.notes.trim() || null,
      termsUrl: draft.termsUrl.trim() || null,
      active: draft.active,
      version: draft.version,
      groups: draft.groups.map(group => ({
        id: group.id,
        version: group.version,
        categoryName: group.categoryName.trim(),
        cashbackRate: Number(group.cashbackRate),
        maxCashbackAmount: Number(group.maxCashbackAmount),
        mccCodes: [...group.mccCodes]
      }))
    };
  }

  private errorMessage(error: {status?: number; error?: Partial<ApiError>}, fallbackKey: string): string {
    if (error.status === 409) return this.i18n.t('creditBenefits.stale');
    return error.error?.message || this.i18n.t(fallbackKey);
  }
}

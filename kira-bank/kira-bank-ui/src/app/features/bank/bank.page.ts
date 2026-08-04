import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EMPTY, expand, forkJoin, Observable, reduce} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {LanguageService} from '../../core/i18n/language.service';
import {Bank, Card, PageResponse} from '../../shared/models/api.models';
import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {CreditCardPreviewComponent} from '../../shared/credit-card-preview/credit-card-preview';

@Component({
  selector: 'app-bank-page',
  imports: [DecimalPipe, ReactiveFormsModule, CustomSelectComponent, CreditCardPreviewComponent],
  templateUrl: './bank.page.html',
  styleUrl: './bank.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankPage {
  private static readonly CATALOG_PAGE_SIZE = 100;
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly i18n = inject(LanguageService);

  readonly loading = signal(true);
  readonly banks = signal<Bank[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly selectedBankId = signal<number | 'ALL'>('ALL');
  readonly searchQuery = signal('');

  readonly openBankDialog = signal(false);
  readonly openCardDialog = signal(false);
  readonly saving = signal(false);

  readonly bankForm = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.maxLength(20)]),
    name: new FormControl('', [Validators.required, Validators.maxLength(150)]),
    shortName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    logoUrl: new FormControl(''),
    website: new FormControl(''),
    hotline: new FormControl(''),
    brandColor: new FormControl('#0878ff')
  });

  readonly cardForm = new FormGroup({
    bankId: new FormControl<number | null>(null, [Validators.required]),
    cardName: new FormControl('', [Validators.required, Validators.maxLength(150)]),
    cardCode: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    cardNetwork: new FormControl('VISA', [Validators.required]),
    cardTier: new FormControl('SIGNATURE', [Validators.required]),
    annualFee: new FormControl<number | null>(0),
    cashbackLimit: new FormControl<number | null>(0),
    imageUrl: new FormControl(''),
    description: new FormControl('')
  });

  readonly cardFormValues = signal<Record<string, any>>({});

  readonly filteredBanks = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.banks();
    if (!q) return list;
    return list.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.shortName.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q)
    );
  });

  readonly bankOptions = computed<SelectOption[]>(() => {
    return this.banks().map(b => ({
      value: b.id,
      label: `${b.shortName || b.name} (${b.code})`,
      iconUrl: b.logoUrl || undefined
    }));
  });

  readonly filteredCards = computed(() => {
    const bankId = this.selectedBankId();
    const list = this.cards();
    if (bankId === 'ALL') return list;
    return list.filter(c => c.bankId === bankId);
  });

  readonly selectedBank = computed(() => {
    const bankId = this.selectedBankId();
    if (bankId === 'ALL') return null;
    return this.banks().find(b => b.id === bankId) ?? null;
  });

  readonly cardPreviewBankName = computed(() => {
    const vals = this.cardFormValues();
    const bankId = vals['bankId'];
    if (!bankId) return 'N/A';
    const found = this.banks().find(b => b.id === Number(bankId));
    return found ? (found.shortName || found.name) : 'KIRA BANK';
  });

  readonly cardPreviewBankLogo = computed(() => {
    const vals = this.cardFormValues();
    const bankId = vals['bankId'];
    if (!bankId) return '';
    const found = this.banks().find(b => b.id === Number(bankId));
    return found?.logoUrl || '';
  });

  constructor() {
    this.loadData();
    this.cardForm.valueChanges.subscribe(vals => {
      this.cardFormValues.set(vals);
    });
  }

  loadData(): void {
    this.loading.set(true);
    forkJoin({
      banks: this.loadAllPages((page, size) => this.api.banks('', page, size)),
      cards: this.loadAllPages((page, size) => this.api.cards('', page, size))
    }).subscribe({
      next: ({banks, cards}) => {
        this.banks.set(banks);
        this.cards.set(cards);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private loadAllPages<T>(request: (page: number, size: number) => Observable<PageResponse<T>>): Observable<T[]> {
    return request(0, BankPage.CATALOG_PAGE_SIZE).pipe(
      expand(response => response.meta.page + 1 < response.meta.totalPages
        ? request(response.meta.page + 1, BankPage.CATALOG_PAGE_SIZE)
        : EMPTY),
      reduce((items, response) => [...items, ...response.data], [] as T[])
    );
  }

  selectBank(bankId: number | 'ALL'): void {
    this.selectedBankId.set(bankId);
  }

  getCardsCountForBank(bankId: number): number {
    return this.cards().filter(c => c.bankId === bankId).length;
  }

  formatMoney(val: number | null | undefined): string {
    if (!val) return '0';
    return new Intl.NumberFormat('vi-VN').format(val);
  }

  openAddBank(): void {
    this.bankForm.reset({
      code: '',
      name: '',
      shortName: '',
      logoUrl: '',
      website: '',
      hotline: '',
      brandColor: '#0878ff'
    });
    this.openBankDialog.set(true);
  }

  closeBankDialog(): void {
    this.openBankDialog.set(false);
  }

  submitBank(): void {
    if (this.bankForm.invalid) {
      this.bankForm.markAllAsTouched();
      return;
    }
    const val = this.bankForm.getRawValue();
    const newBank: Bank = {
      id: Date.now(),
      vietqrId: null,
      code: val.code || 'BANK',
      name: val.name || '',
      shortName: val.shortName || val.name || '',
      logoUrl: val.logoUrl || null,
      bin: null,
      swiftCode: null,
      transferSupported: true,
      lookupSupported: true,
      website: val.website || null,
      hotline: val.hotline || null,
      brandColor: val.brandColor || '#0878ff',
      description: ''
    };

    this.banks.update(list => [newBank, ...list]);
    this.toast.show(`Đã thêm ngân hàng ${newBank.shortName} thành công`, 'success');
    this.closeBankDialog();
  }

  openAddCard(defaultBankId?: number): void {
    const targetBankId = defaultBankId ?? (this.selectedBankId() !== 'ALL' ? (this.selectedBankId() as number) : (this.banks()[0]?.id ?? null));
    this.cardForm.reset({
      bankId: targetBankId,
      cardName: '',
      cardCode: '',
      cardNetwork: 'VISA',
      cardTier: 'SIGNATURE',
      annualFee: 0,
      cashbackLimit: 0,
      imageUrl: '',
      description: ''
    });
    this.cardFormValues.set(this.cardForm.getRawValue());
    this.openCardDialog.set(true);
  }

  closeCardDialog(): void {
    this.openCardDialog.set(false);
  }

  submitCard(): void {
    if (this.cardForm.invalid) {
      this.cardForm.markAllAsTouched();
      return;
    }
    const val = this.cardForm.getRawValue();
    const bank = this.banks().find(b => b.id === Number(val.bankId));

    const newCard: Card = {
      id: Date.now(),
      bankId: Number(val.bankId),
      bankName: bank ? (bank.shortName || bank.name) : '',
      cardName: val.cardName || '',
      cardCode: val.cardCode || '',
      cardNetwork: val.cardNetwork || 'VISA',
      cardTier: val.cardTier || 'SIGNATURE',
      annualFee: Number(val.annualFee || 0),
      currency: 'VND',
      cashbackLimit: Number(val.cashbackLimit || 0),
      cashbackCondition: '',
      description: val.description || '',
      imageUrl: val.imageUrl || ''
    };

    this.cards.update(list => [newCard, ...list]);
    this.toast.show(`Đã thêm loại thẻ "${newCard.cardName}" thành công`, 'success');
    this.closeCardDialog();
  }
}

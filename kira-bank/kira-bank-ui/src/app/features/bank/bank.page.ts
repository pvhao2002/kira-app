import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EMPTY, expand, Observable, reduce} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {Bank, PageResponse} from '../../shared/models/api.models';

@Component({
  selector: 'app-bank-page',
  imports: [ReactiveFormsModule],
  templateUrl: './bank.page.html',
  styleUrl: './bank.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankPage {
  private static readonly PAGE_SIZE = 100;
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly i18n = inject(LanguageService);

  readonly loading = signal(true);
  readonly banks = signal<Bank[]>([]);
  readonly searchQuery = signal('');
  readonly openBankDialog = signal(false);

  readonly bankForm = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.maxLength(20)]),
    name: new FormControl('', [Validators.required, Validators.maxLength(150)]),
    shortName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    logoUrl: new FormControl(''),
    website: new FormControl(''),
    hotline: new FormControl(''),
    brandColor: new FormControl('#0878ff')
  });

  readonly filteredBanks = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.banks();
    return this.banks().filter(bank =>
      bank.name.toLowerCase().includes(query) ||
      bank.shortName.toLowerCase().includes(query) ||
      bank.code.toLowerCase().includes(query)
    );
  });

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.loadAllPages((page, size) => this.api.banks('', page, size)).subscribe({
      next: banks => {
        this.banks.set(banks);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private loadAllPages<T>(request: (page: number, size: number) => Observable<PageResponse<T>>): Observable<T[]> {
    return request(0, BankPage.PAGE_SIZE).pipe(
      expand(response => response.meta.page + 1 < response.meta.totalPages
        ? request(response.meta.page + 1, BankPage.PAGE_SIZE)
        : EMPTY),
      reduce((items, response) => [...items, ...response.data], [] as T[])
    );
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

    const value = this.bankForm.getRawValue();
    const newBank: Bank = {
      id: Date.now(),
      vietqrId: null,
      code: value.code || 'BANK',
      name: value.name || '',
      shortName: value.shortName || value.name || '',
      logoUrl: value.logoUrl || null,
      bin: null,
      swiftCode: null,
      transferSupported: true,
      lookupSupported: true,
      website: value.website || null,
      hotline: value.hotline || null,
      brandColor: value.brandColor || '#0878ff',
      description: ''
    };

    this.banks.update(banks => [newBank, ...banks]);
    this.toast.show(`Đã thêm ngân hàng ${newBank.shortName} thành công`, 'success');
    this.closeBankDialog();
  }
}

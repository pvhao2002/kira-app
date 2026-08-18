import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {debounceTime, distinctUntilChanged, EMPTY, expand, Observable, reduce, Subject} from 'rxjs';
import {AuthStore} from '../../core/auth/auth.store';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {Bank, PageResponse} from '../../shared/models/api.models';
import {IconComponent} from '../../shared/icon/icon';

@Component({
  selector: 'app-bank-page',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './bank.page.html',
  styleUrl: './bank.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankPage {
  private static readonly PAGE_SIZE = 100;
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  readonly auth = inject(AuthStore);
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
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.searchQuery.set(params.get('search') ?? '');
      this.loadData();
    });
    this.searchChanges.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(search => {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {search: search || null},
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    });
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchChanges.next(value.trim());
  }

  loadData(): void {
    this.loading.set(true);
    this.loadAllPages((page, size) => this.api.banks(this.searchQuery().trim(), page, size)).subscribe({
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
    if (!this.auth.admin()) return;

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
    if (!this.auth.admin()) {
      this.closeBankDialog();
      return;
    }

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

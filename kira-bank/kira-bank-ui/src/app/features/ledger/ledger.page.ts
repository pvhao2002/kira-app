import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {LanguageService} from '../../core/i18n/language.service';
import {ApiService} from '../../core/services/api.service';

import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {computed} from '@angular/core';

type Row = Record<string, unknown>;

@Component({
  selector: 'app-ledger',
  imports: [ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './ledger.page.html',
  styleUrl: './ledger.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LedgerPage {
  readonly i18n = inject(LanguageService);
  readonly accounts = signal<Row[]>([]);
  readonly accountOptions = computed<SelectOption[]>(() =>
    this.accounts().map(a => ({ value: a['id'], label: String(a['accountName'] ?? '') }))
  );
  readonly rows = signal<Row[]>([]);
  readonly loading = signal(false);
  readonly accountId = new FormControl<number | null>(null);
  readonly columns = ['entryDate', 'entryType', 'amount', 'currency', 'balanceBefore', 'balanceAfter', 'description'];
  private readonly api = inject(ApiService);

  constructor() {
    this.accountId.valueChanges.subscribe(() => this.load());
    this.api.page<Row>('investment/accounts', 0, 100).subscribe(response => {
      this.accounts.set(response.data);
      const first = response.data[0]?.['id'];
      if (typeof first === 'number') {
        this.accountId.setValue(first);
      }
    });
  }

  load(): void {
    const id = this.accountId.value;
    if (!id) {
      this.rows.set([]);
      return;
    }
    this.loading.set(true);
    this.api.page<Row>(`investment/accounts/${id}/ledger`, 0, 50).subscribe({
      next: response => {
        this.rows.set(response.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  label(column: string): string {
    const key = `field.${column}`;
    return this.i18n.has(key) ? this.i18n.t(key)
      : column.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase());
  }

  display(value: unknown): string {
    if (typeof value === 'number') return value.toLocaleString('vi-VN');
    return value == null ? '—' : String(value);
  }
}

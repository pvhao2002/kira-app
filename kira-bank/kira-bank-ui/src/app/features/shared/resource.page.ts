import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {debounceTime, distinctUntilChanged, EMPTY, expand, finalize, map, Observable, reduce, Subject} from 'rxjs';
import {LanguageService} from '../../core/i18n/language.service';
import {TranslationKey} from '../../core/i18n/translations';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {
  LookupKey,
  RequestMethod,
  ResourceActionDefinition,
  ResourceColumnKind,
  ResourceDefinition,
  ResourceField,
  ResourceFormDefinition,
  resourceDefinitions
} from './resource-definitions';

type Row = Record<string, unknown>;

import {CustomSelectComponent} from '../../shared/custom-select/custom-select';
import {CustomDatepickerComponent} from '../../shared/custom-datepicker/custom-datepicker';
import {CreditCardPreviewComponent} from '../../shared/credit-card-preview/credit-card-preview';
import {CreditCardBankLimit} from '../../shared/models/api.models';

interface LookupOption {
  value: string | number;
  label: string;
  iconUrl?: string;
  sublabel?: string;
}

@Component({
  selector: 'app-resource',
  imports: [ReactiveFormsModule, CustomSelectComponent, CustomDatepickerComponent, CreditCardPreviewComponent],
  templateUrl: './resource.page.html',
  styleUrl: './resource.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourcePage {
  readonly loading = signal(true);
  readonly rows = signal<Row[]>([]);
  readonly total = signal(0);
  readonly columns = signal<string[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly loadingDetail = signal(false);
  readonly activeForm = signal<ResourceFormDefinition | null>(null);
  readonly selectedRow = signal<Row | null>(null);
  readonly editing = signal(false);
  readonly lookups = signal<Record<string, LookupOption[]>>({});
  readonly rawLookups = signal<Record<string, Row[]>>({});
  readonly formValues = signal<Record<string, unknown>>({});
  readonly formError = signal('');
  readonly sharedCreditLimit = signal(false);
  form = new FormGroup<Record<string, FormControl<unknown>>>({});
  readonly i18n = inject(LanguageService);
  private formSub?: any;

  readonly searchQuery = signal('');
  readonly showFilterPanel = signal(false);
  readonly selectedStatus = signal('ALL');

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  readonly definition = resourceDefinitions[this.route.snapshot.data['resourceKey'] as string] as ResourceDefinition;
  readonly titleKey = this.definition.titleKey as TranslationKey;
  readonly apiPath = this.definition.apiPath;
  readonly flow = this.definition.flow;
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly creditCardLimits = signal<Record<string, CreditCardBankLimit>>({});
  private readonly creditCardLimitsLoaded = signal(false);
  private bankSub?: any;

  readonly filteredRows = computed(() => {
    let list = this.rows();
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.selectedStatus();

    if (status !== 'ALL') {
      list = list.filter(row => String(row['status'] ?? '').toUpperCase() === status);
    }

    if (!query) return list;

    return list.filter(row =>
      Object.values(row).some(val =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(query)
      )
    );
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.searchQuery.set(params.get('search') ?? '');
      this.loadRows();
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
    if (this.definition.key === 'creditCards') this.loadCreditCardLimits();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchChanges.next(value.trim());
  }

  resetFilters(): void {
    this.onSearchInput('');
    this.selectedStatus.set('ALL');
  }

  get isFilterActive(): boolean {
    return this.selectedStatus() !== 'ALL' || this.searchQuery().trim().length > 0;
  }

  toggleFilter(): void {
    this.showFilterPanel.set(!this.showFilterPanel());
  }

  setStatusFilter(status: string): void {
    this.selectedStatus.set(status);
  }

  exportData(): void {
    const list = this.filteredRows();
    if (!list.length) {
      this.toast.show('No data available to export', 'info');
      return;
    }

    const cols = this.columns();
    const headers = cols.map(c => this.label(c)).join(',');
    const rowsCsv = list.map((row: Row) =>
      cols.map(c => `"${String(row[c] ?? '').replaceAll('"', '""')}"`).join(',')
    ).join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers + '\n' + rowsCsv;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${this.definition.key}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toast.show('Data exported to CSV successfully', 'success');
  }

  get availableActions(): ResourceActionDefinition[] {
    return this.definition.actions ?? [];
  }

  get flowLabel(): string {
    return this.i18n.t(this.flow === 'credit' ? 'resource.flowCredit'
      : this.flow === 'investment' ? 'resource.flowInvestment' : 'resource.flowSystem');
  }

  get title(): string {
    return this.i18n.t(this.titleKey);
  }

  openCreate(): void {
    if (!this.definition.create) return;
    this.editing.set(false);
    this.selectedRow.set(null);
    this.openForm(this.definition.create, null);
  }

  openEdit(row: Row): void {
    const definition = this.definition.edit;
    if (!definition) return;
    this.editing.set(true);
    this.selectedRow.set(row);
    if (definition.detailPath) {
      this.loadingDetail.set(true);
      this.api.get<Row>(definition.detailPath(row)).pipe(finalize(() => this.loadingDetail.set(false))).subscribe({
        next: detail => this.openForm(definition, detail),
        error: () => undefined
      });
      return;
    }
    this.openForm(definition, row);
  }

  openAction(action: ResourceActionDefinition, row: Row): void {
    if (action.form) {
      this.editing.set(false);
      this.selectedRow.set(row);
      this.openForm(action.form, row);
      return;
    }
    if (!action.method || !action.path) return;
    if (action.confirmKey && !window.confirm(this.i18n.t(action.confirmKey))) return;
    this.executeRequest(action.method, action.path(row), {}, false);
  }

  isActionVisible(action: ResourceActionDefinition, row: Row): boolean {
    return action.visible ? action.visible(row) : true;
  }

  closeDialog(): void {
    this.open.set(false);
    this.activeForm.set(null);
    this.selectedRow.set(null);
    this.formError.set('');
    this.sharedCreditLimit.set(false);
  }

  submit(): void {
    const definition = this.activeForm();
    if (!definition) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const values = this.serialize(definition.fields, raw);
    const path = definition.path(this.selectedRow(), values);
    for (const field of definition.stripFields ?? []) delete values[field];
    this.executeRequest(definition.method, path, values, definition.idempotent ?? false, true);
  }

  fieldError(field: ResourceField): string {
    const control = this.form.controls[field.name];
    if (!control?.touched || !control.errors) return '';
    if (control.errors['required']) return this.i18n.t('form.required');
    if (control.errors['pattern']) return this.i18n.t('form.invalidFormat');
    if (control.errors['min']) return this.i18n.t('form.minimum', {value: field.min ?? 0});
    if (control.errors['max']) return this.i18n.t('form.maximum', {value: field.max ?? 0});
    if (control.errors['maxlength']) return this.i18n.t('form.maxLength', {value: field.maxLength ?? 0});
    return this.i18n.t('form.invalidValue');
  }

  options(field: ResourceField): LookupOption[] {
    if (field.lookup) return this.lookups()[field.lookup] ?? [];
    return (field.options ?? []).map(option => ({value: option.value, label: this.i18n.t(option.labelKey)}));
  }

  label(column: string): string {
    const key = `field.${column}`;
    if (this.i18n.has(key)) return this.i18n.t(key);
    return column.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase());
  }

  display(value: unknown): string {
    if (typeof value === 'number') return value.toLocaleString('vi-VN');
    if (value === null || value === undefined) return '—';
    return String(value);
  }

  columnKind(column: string): ResourceColumnKind {
    return this.definition.columns?.find(item => item.name === column)?.kind
      ?? (column === 'status' ? 'status' : 'text');
  }

  columnImage(row: Row, column: string): string {
    const imageField = this.definition.columns?.find(item => item.name === column)?.imageField;
    const value = imageField ? row[imageField] : null;
    return typeof value === 'string' ? value : '';
  }

  columnSecondary(row: Row, column: string): string {
    const secondaryField = this.definition.columns?.find(item => item.name === column)?.secondaryField;
    const value = secondaryField ? row[secondaryField] : null;
    return value === null || value === undefined || value === '' ? '' : String(value);
  }

  displayMoney(row: Row, column: string): string {
    const value = row[column];
    if (value === null || value === undefined || value === '') return '—';
    const amount = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(amount)) return this.display(value);
    const definition = this.definition.columns?.find(item => item.name === column);
    const currency = definition?.currencyField ? row[definition.currencyField] : null;
    const locale = this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US';
    const formatted = amount.toLocaleString(locale, {maximumFractionDigits: 4});
    return currency ? `${formatted} ${String(currency)}` : formatted;
  }

  displayDay(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    return this.i18n.t('format.dayOfMonth', {value: String(value)});
  }

  billingLabel(row: Row): string {
    const status = String(row['billingStatus'] ?? 'NOT_DUE').toLowerCase();
    return this.i18n.t(`billing.${status}`);
  }

  billingClass(row: Row): string {
    return `billing-badge billing-${String(row['billingStatus'] ?? 'NOT_DUE').toLowerCase().replaceAll('_', '-')}`;
  }

  billingBalance(row: Row): string {
    const value = row['statementBalance'];
    if (value === null || value === undefined || Number(value) === 0) return '';
    const locale = this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US';
    const formatted = Number(value).toLocaleString(locale, {maximumFractionDigits: 4});
    return row['currency'] ? `${formatted} ${String(row['currency'])}` : formatted;
  }

  billingStatementDate(row: Row): string {
    return this.billingDate(row['statementDate']);
  }

  billingDueDate(row: Row): string {
    return this.billingDate(row['paymentDueDate']);
  }

  private billingDate(value: unknown): string {
    if (!value) return '';
    return new Intl.DateTimeFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US').format(
      new Date(`${String(value)}T00:00:00`)
    );
  }

  rowClass(row: Row): string {
    const field = this.definition.rowHighlightField;
    if (!field) return '';
    const status = String(row[field] ?? 'NOT_DUE').toLowerCase().replaceAll('_', '-');
    return ['needs-input', 'unpaid', 'overdue'].includes(status) ? `billing-row billing-${status}` : '';
  }

  billingAmountError(): string {
    if (!this.form.hasError('minimumPaymentExceedsBalance') || !this.form.controls['minimumPayment']?.touched) return '';
    return this.i18n.t('form.minimumPaymentExceedsBalance');
  }

  hideBrokenImage(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  private loadRows(): void {
    if (!this.apiPath) {
      this.rows.set([]);
      this.total.set(0);
      this.columns.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.api.page<Row>(this.apiPath, 0, 20, this.searchQuery().trim()).subscribe({
      next: response => {
        this.rows.set(response.data);
        this.total.set(response.meta.totalElements);
        const hiddenColumns = new Set([
          'id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'version', 'note'
        ]);
        const configuredColumns = this.definition.columns?.map(column => column.name) ?? [];
        this.columns.set(configuredColumns.length
          ? configuredColumns
          : response.data[0]
            ? Object.keys(response.data[0]).filter(column => !hiddenColumns.has(column)).slice(0, 7)
            : []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private openForm(definition: ResourceFormDefinition, values: Row | null): void {
    this.activeForm.set(definition);
    this.formError.set('');
    const controls: Record<string, FormControl<unknown>> = {};
    for (const field of definition.fields) {
      const validators: ValidatorFn[] = [];
      if (field.required) validators.push(Validators.required);
      if (field.min !== undefined) validators.push(Validators.min(field.min));
      if (field.max !== undefined) validators.push(Validators.max(field.max));
      if (field.maxLength !== undefined) validators.push(Validators.maxLength(field.maxLength));
      if (field.pattern) validators.push(Validators.pattern(field.pattern));
      const sourceField = field.sourceField ?? field.name;
      const initial = this.deserializeValue(field, values?.[sourceField] ?? field.defaultValue ?? '');
      const control = new FormControl<unknown>(initial, validators);
      if (this.editing() && field.readonlyOnEdit) control.disable();
      controls[field.name] = control;
    }
    this.form = new FormGroup(controls);
    if (definition.validation === 'billingCycle') {
      this.form.addValidators(group => {
        const balance = Number(group.get('statementBalance')?.value);
        const minimum = Number(group.get('minimumPayment')?.value);
        return Number.isFinite(balance) && Number.isFinite(minimum) && minimum > balance
          ? {minimumPaymentExceedsBalance: true}
          : null;
      });
      this.form.updateValueAndValidity({emitEvent: false});
    }
    this.formValues.set(this.form.getRawValue());
    this.formSub?.unsubscribe();
    this.formSub = this.form.valueChanges.subscribe(() => {
      this.formValues.set(this.form.getRawValue());
    });
    this.bankSub?.unsubscribe();
    this.bankSub = this.form.controls['bankId']?.valueChanges.subscribe(() => this.syncCreditLimitField());
    this.loadLookups(definition.fields);
    this.syncCreditLimitField();
    this.form.markAsPristine();
    this.open.set(true);
  }

  readonly selectedBank = computed(() => {
    const formVals = this.formValues();
    const bankId = formVals['bankId'] ?? this.selectedRow()?.['bankId'];
    if (!bankId) return null;
    const list = this.rawLookups()['banks'] ?? [];
    return list.find(bank => String(bank['id']) === String(bankId)) ?? null;
  });

  readonly cardPreviewBank = computed(() => String(
    this.selectedBank()?.['shortName'] ?? this.selectedBank()?.['name'] ?? ''
  ));
  readonly cardPreviewBankLogo = computed(() => String(this.selectedBank()?.['logoUrl'] ?? ''));
  readonly cardPreviewNickname = computed(() => String(this.formValues()['nickname'] ?? ''));
  readonly cardPreviewLastFour = computed(() => String(this.formValues()['lastFour'] ?? ''));
  readonly cardPreviewCreditLimit = computed(() => this.formValues()['creditLimit'] as number | string | null);
  readonly cardPreviewStatementDay = computed(() => this.formValues()['statementDay'] as number | string | null);
  readonly cardPreviewDueDay = computed(() => this.formValues()['dueDay'] as number | string | null);

  private loadLookups(fields: ResourceField[]): void {
    const keys = [...new Set(fields.map(field => field.lookup).filter((key): key is LookupKey => !!key))];
    for (const key of keys) {
      if (this.lookups()[key]) continue;
      this.loadLookupRows(key).subscribe({
        next: rows => {
          this.rawLookups.update(current => ({...current, [key]: rows}));
          this.lookups.update(current => ({
            ...current,
            [key]: rows.map(row => this.lookupOption(key, row))
          }));
        },
        error: () => {
          this.rawLookups.update(current => ({...current, [key]: []}));
          this.lookups.update(current => ({...current, [key]: []}));
        }
      });
    }
  }

  private lookupPath(key: LookupKey): string {
    return {
      banks: 'public/banks',
      platforms: 'investment/platforms',
      accounts: 'investment/accounts',
      tasks: 'investment/tasks'
    }[key];
  }

  private loadLookupRows(key: LookupKey): Observable<Row[]> {
    const firstPage = this.api.page<Row>(this.lookupPath(key), 0, 100);
    if (key !== 'banks') return firstPage.pipe(map(response => response.data));

    return firstPage.pipe(
      expand(response => response.meta.page + 1 < response.meta.totalPages
        ? this.api.page<Row>(this.lookupPath(key), response.meta.page + 1, 100)
        : EMPTY),
      map(response => response.data),
      reduce((all: Row[], pageRows: Row[]) => [...all, ...pageRows], [])
    );
  }

  private loadCreditCardLimits(): void {
    this.api.creditCardBankLimits().subscribe({
      next: limits => {
        this.creditCardLimits.set(Object.fromEntries(limits.map(limit => [String(limit.bankId), limit])));
        this.creditCardLimitsLoaded.set(true);
        this.syncCreditLimitField();
      },
      error: () => {
        this.creditCardLimits.set({});
        this.creditCardLimitsLoaded.set(false);
        this.syncCreditLimitField();
      }
    });
  }

  private syncCreditLimitField(): void {
    if (this.activeForm()?.layout !== 'creditCard') return;
    const control = this.form.controls['creditLimit'];
    if (!control) return;

    if (this.editing()) {
      control.enable({emitEvent: false});
      this.sharedCreditLimit.set(true);
      this.formValues.set(this.form.getRawValue());
      return;
    }

    const bankId = this.form.controls['bankId']?.value;
    if (!bankId || !this.creditCardLimitsLoaded()) {
      control.disable({emitEvent: false});
      this.sharedCreditLimit.set(false);
      this.formValues.set(this.form.getRawValue());
      return;
    }

    const existing = this.creditCardLimits()[String(bankId)];
    if (existing) {
      control.setValue(existing.creditLimit, {emitEvent: false});
      control.disable({emitEvent: false});
      this.sharedCreditLimit.set(true);
    } else {
      control.setValue('', {emitEvent: false});
      control.enable({emitEvent: false});
      this.sharedCreditLimit.set(false);
    }
    this.formValues.set(this.form.getRawValue());
  }

  private lookupOption(key: LookupKey, row: Row): LookupOption {
    const value = row['id'] as string | number;
    const label = {
      banks: String(row['shortName'] ?? row['name'] ?? value),
      platforms: String(row['name'] ?? row['code'] ?? value),
      accounts: String(row['accountName'] ?? row['externalAccountCode'] ?? value),
      tasks: String(row['taskName'] ?? row['taskCode'] ?? value)
    }[key];
    const iconUrl = key === 'banks' ? (row['logoUrl'] as string || undefined) : undefined;
    const sublabel = key === 'banks' ? String(row['code'] ?? '') || undefined : undefined;
    return {value, label, iconUrl, sublabel};
  }

  private serialize(fields: ResourceField[], raw: Record<string, unknown>): Record<string, unknown> {
    const values = {...raw};
    for (const field of fields) {
      const value = values[field.name];
      if (value === '') {
        values[field.name] = null;
      } else if (field.type === 'percentage' && typeof value === 'number') {
        values[field.name] = value / 100;
      } else if (field.type === 'datetime' && value) {
        values[field.name] = new Date(String(value)).toISOString();
      }
    }
    return values;
  }

  private deserializeValue(field: ResourceField, value: unknown): unknown {
    if (field.type === 'percentage' && typeof value === 'number') return value * 100;
    if (field.type === 'datetime' && value) {
      const date = new Date(String(value));
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
      return local.toISOString().slice(0, 16);
    }
    return value ?? '';
  }

  private executeRequest(
    method: RequestMethod,
    path: string,
    body: Record<string, unknown>,
    idempotent: boolean,
    closeOnSuccess = false
  ): void {
    this.saving.set(true);
    this.formError.set('');
    const request = method === 'put' ? this.api.put(path, body)
      : method === 'patch' ? this.api.patch(path, body) : this.api.post(path, body, idempotent);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('form.saved'), 'success');
        if (closeOnSuccess) {
          this.form.markAsPristine();
          this.open.set(false);
          this.activeForm.set(null);
        }
        if (this.definition.key === 'creditCards') this.loadCreditCardLimits();
        this.loadRows();
      },
      error: error => this.formError.set(error.error?.message ?? this.i18n.t('form.saveFailed'))
    });
  }
}

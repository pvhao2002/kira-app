import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {finalize} from 'rxjs';
import {LanguageService} from '../../core/i18n/language.service';
import {TranslationKey} from '../../core/i18n/translations';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {
  LookupKey,
  RequestMethod,
  ResourceActionDefinition,
  ResourceDefinition,
  ResourceField,
  ResourceFormDefinition,
  resourceDefinitions
} from './resource-definitions';

type Row = Record<string, unknown>;

interface LookupOption {
  value: string | number;
  label: string;
}

@Component({
  selector: 'app-resource',
  imports: [ReactiveFormsModule],
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
  readonly formError = signal('');
  form = new FormGroup<Record<string, FormControl<unknown>>>({});
  readonly i18n = inject(LanguageService);

  private readonly route = inject(ActivatedRoute);
  readonly definition = resourceDefinitions[this.route.snapshot.data['resourceKey'] as string] as ResourceDefinition;
  readonly titleKey = this.definition.titleKey as TranslationKey;
  readonly apiPath = this.definition.apiPath;
  readonly flow = this.definition.flow;
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  constructor() {
    this.loadRows();
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
      this.openForm(action.form, null);
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
    if (this.form.dirty && !window.confirm(this.i18n.t('form.confirmDiscard'))) return;
    this.open.set(false);
    this.activeForm.set(null);
    this.selectedRow.set(null);
    this.formError.set('');
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

  private loadRows(): void {
    if (!this.apiPath) {
      this.rows.set([]);
      this.total.set(0);
      this.columns.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.api.page<Row>(this.apiPath).subscribe({
      next: response => {
        this.rows.set(response.data);
        this.total.set(response.meta.totalElements);
        const hiddenColumns = new Set([
          'id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'version', 'note'
        ]);
        this.columns.set(response.data[0]
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
      const initial = this.deserializeValue(field, values?.[field.name] ?? field.defaultValue ?? '');
      const control = new FormControl<unknown>(initial, validators);
      if (this.editing() && field.readonlyOnEdit) control.disable();
      controls[field.name] = control;
    }
    this.form = new FormGroup(controls);
    this.loadLookups(definition.fields);
    this.form.markAsPristine();
    this.open.set(true);
  }

  private loadLookups(fields: ResourceField[]): void {
    const keys = [...new Set(fields.map(field => field.lookup).filter((key): key is LookupKey => !!key))];
    for (const key of keys) {
      if (this.lookups()[key]) continue;
      this.api.page<Row>(this.lookupPath(key), 0, 100).subscribe({
        next: response => this.lookups.update(current => ({
          ...current,
          [key]: response.data.map(row => this.lookupOption(key, row))
        })),
        error: () => this.lookups.update(current => ({...current, [key]: []}))
      });
    }
  }

  private lookupPath(key: LookupKey): string {
    return {
      catalogCards: 'public/cards',
      userCards: 'credit-cards',
      mccs: 'public/mccs',
      statements: 'statements',
      serviceProviders: 'service-providers',
      platforms: 'investment/platforms',
      accounts: 'investment/accounts',
      tasks: 'investment/tasks'
    }[key];
  }

  private lookupOption(key: LookupKey, row: Row): LookupOption {
    const value = row['id'] as string | number;
    const label = {
      catalogCards: `${row['bankName'] ?? ''} · ${row['cardName'] ?? row['cardCode'] ?? value}`,
      userCards: `${row['nickname'] ?? value}${row['lastFour'] ? ` · •••• ${row['lastFour']}` : ''}`,
      mccs: `${row['code'] ?? ''} · ${row['name'] ?? value}`,
      statements: `#${value} · ${row['remainingAmount'] ?? row['statementBalance'] ?? ''}`,
      serviceProviders: String(row['name'] ?? value),
      platforms: String(row['name'] ?? row['code'] ?? value),
      accounts: String(row['accountName'] ?? row['externalAccountCode'] ?? value),
      tasks: String(row['taskName'] ?? row['taskCode'] ?? value)
    }[key];
    return {value, label};
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
        this.loadRows();
      },
      error: error => this.formError.set(error.error?.message ?? this.i18n.t('form.saveFailed'))
    });
  }
}

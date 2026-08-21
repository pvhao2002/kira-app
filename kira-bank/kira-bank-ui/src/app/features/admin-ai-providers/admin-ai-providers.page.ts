import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {LanguageService} from '../../core/i18n/language.service';
import {TranslationKey} from '../../core/i18n/translations';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {AiProviderAccountStatus, CloudflareAccount} from '../../shared/models/api.models';

@Component({
  selector: 'app-admin-cloudflare-accounts', imports: [ReactiveFormsModule],
  templateUrl: './admin-ai-providers.page.html', styleUrl: './admin-ai-providers.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAiProvidersPage {
  readonly i18n = inject(LanguageService);
  readonly accounts = signal<CloudflareAccount[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly actingId = signal<number | null>(null);
  readonly error = signal('');
  readonly editing = signal<CloudflareAccount | null>(null);
  readonly formOpen = signal(false);
  readonly form = new FormGroup({
    displayName: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.maxLength(100)]}),
    accountId: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(64)]}),
    apiToken: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(2048)]}),
    aiModel: new FormControl('@cf/moonshotai/kimi-k2.7-code', {nonNullable: true, validators: [Validators.required, Validators.maxLength(180)]}),
    priority: new FormControl(100, {nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(100000)]}),
    r2AccessKeyId: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(2048)]}),
    r2SecretAccessKey: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(2048)]}),
    r2BucketName: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(255)]}),
    r2PublicUrl: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(500)]})
  });
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  constructor() { this.load(); }

  load(clearError = true): void {
    this.loading.set(true);
    if (clearError) this.error.set('');
    this.api.cloudflareAccounts().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: accounts => this.accounts.set(accounts),
      error: () => this.error.set(this.i18n.t('aiProviders.loadFailed'))
    });
  }

  create(): void {
    this.editing.set(null);
    this.form.reset({displayName: '', accountId: '', apiToken: '', aiModel: '@cf/moonshotai/kimi-k2.7-code', priority: 100,
      r2AccessKeyId: '', r2SecretAccessKey: '', r2BucketName: '', r2PublicUrl: ''});
    this.form.controls.accountId.setValidators([Validators.required, Validators.maxLength(64)]);
    this.formOpen.set(true);
  }

  edit(account: CloudflareAccount): void {
    this.editing.set(account);
    this.form.reset({displayName: account.displayName, accountId: '', apiToken: '', aiModel: account.ai.model,
      priority: account.ai.priority, r2AccessKeyId: '', r2SecretAccessKey: '', r2BucketName: '', r2PublicUrl: ''});
    this.form.controls.accountId.setValidators([Validators.maxLength(64)]);
    this.formOpen.set(true);
  }

  closeForm(): void { this.formOpen.set(false); this.editing.set(null); }

  save(): void {
    this.form.controls.accountId.updateValueAndValidity();
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const values = this.form.getRawValue();
    const current = this.editing();
    const request = current
      ? this.api.put<CloudflareAccount>(`admin/cloudflare-accounts/${current.id}`, {...values, version: current.version})
      : this.api.post<CloudflareAccount>('admin/cloudflare-accounts', values);
    this.saving.set(true); this.error.set('');
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.toast.show(this.i18n.t('aiProviders.saved'), 'success'); this.closeForm(); this.load(); },
      error: error => this.error.set(this.errorMessage(error))
    });
  }

  testAi(account: CloudflareAccount): void { this.action(account, 'ai/test', 'aiProviders.aiTestPassed'); }
  toggleAi(account: CloudflareAccount): void {
    this.action(account, account.ai.enabled ? 'ai/disable' : 'ai/enable', account.ai.enabled ? 'aiProviders.disabled' : 'aiProviders.enabled');
  }
  testR2(account: CloudflareAccount): void { this.action(account, 'r2/test', 'aiProviders.r2TestPassed'); }
  toggleR2Primary(account: CloudflareAccount): void {
    this.action(account, account.r2.primary ? 'r2/stop-uploads' : 'r2/make-primary',
      account.r2.primary ? 'aiProviders.r2Stopped' : 'aiProviders.r2Primary');
  }
  adoptLegacy(account: CloudflareAccount): void {
    if (!window.confirm(this.i18n.t('aiProviders.adoptConfirm').replace('{count}', String(account.legacyAttachmentCount)))) return;
    this.action(account, 'r2/adopt-legacy-attachments', 'aiProviders.adopted');
  }

  remove(account: CloudflareAccount): void {
    if (!window.confirm(this.i18n.t('aiProviders.deleteConfirm'))) return;
    this.actingId.set(account.id);
    this.api.deleteWithBody<void>(`admin/cloudflare-accounts/${account.id}`, {version: account.version})
      .pipe(finalize(() => this.actingId.set(null))).subscribe({
        next: () => { this.toast.show(this.i18n.t('aiProviders.deleted'), 'success'); this.load(); },
        error: error => this.error.set(this.errorMessage(error))
      });
  }

  statusLabel(status: AiProviderAccountStatus): string {
    const keys: Record<AiProviderAccountStatus, TranslationKey> = {
      PENDING_TEST: 'aiProviders.statusPending', VERIFIED: 'aiProviders.statusVerified',
      COOLDOWN: 'aiProviders.statusCooldown', BLOCKED: 'aiProviders.statusBlocked'
    };
    return this.i18n.t(keys[status]);
  }

  formatDate(value: string | null): string {
    return value ? new Intl.DateTimeFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US',
      {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value)) : '—';
  }

  private action(account: CloudflareAccount, action: string, successKey: TranslationKey): void {
    this.actingId.set(account.id); this.error.set('');
    this.api.post<CloudflareAccount>(`admin/cloudflare-accounts/${account.id}/${action}`, {version: account.version})
      .pipe(finalize(() => this.actingId.set(null))).subscribe({
        next: () => { this.toast.show(this.i18n.t(successKey), 'success'); this.load(); },
        error: error => { const message = this.errorMessage(error); this.load(false); this.error.set(message); }
      });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') return error.error.message;
    return this.i18n.t('aiProviders.actionFailed');
  }
}

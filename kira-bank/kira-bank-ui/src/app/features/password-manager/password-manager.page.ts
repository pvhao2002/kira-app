import {ChangeDetectionStrategy, Component, computed, OnDestroy, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {IconComponent} from '../../shared/icon/icon';
import {
  PasswordVaultAccount,
  PasswordVaultAccountRequest,
  PasswordVaultModule,
  PasswordVaultSecret
} from '../../shared/models/api.models';

interface ModuleDraft { name: string; websiteUrl: string; description: string }
interface AccountDraft { displayName: string; username: string; password: string; loginUrl: string; note: string }

@Component({
  selector: 'app-password-manager',
  imports: [FormsModule, IconComponent],
  templateUrl: './password-manager.page.html',
  styleUrl: './password-manager.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordManagerPage implements OnDestroy {
  readonly i18n = inject(LanguageService);
  readonly modules = signal<PasswordVaultModule[]>([]);
  readonly accounts = signal<PasswordVaultAccount[]>([]);
  readonly selectedModuleId = signal<number | null>(null);
  readonly loadingModules = signal(true);
  readonly loadingAccounts = signal(false);
  readonly saving = signal(false);
  readonly actingId = signal<number | null>(null);
  readonly search = signal('');
  readonly pageError = signal('');
  readonly moduleDialog = signal(false);
  readonly editingModule = signal<PasswordVaultModule | null>(null);
  readonly moduleDraft = signal<ModuleDraft>({name: '', websiteUrl: '', description: ''});
  readonly accountDialog = signal(false);
  readonly editingAccount = signal<PasswordVaultAccount | null>(null);
  readonly accountDraft = signal<AccountDraft>({displayName: '', username: '', password: '', loginUrl: '', note: ''});
  readonly unlockDialog = signal(false);
  readonly unlockPassword = signal('');
  readonly unlocking = signal(false);
  readonly unlockToken = signal<string | null>(null);
  readonly unlockExpiresAt = signal<number | null>(null);
  readonly revealedAccount = signal<PasswordVaultAccount | null>(null);
  readonly revealedSecret = signal<PasswordVaultSecret | null>(null);
  readonly passwordLength = signal(20);
  readonly useUpper = signal(true);
  readonly useLower = signal(true);
  readonly useDigits = signal(true);
  readonly useSymbols = signal(true);

  readonly selectedModule = computed(() => this.modules().find(item => item.id === this.selectedModuleId()) ?? null);
  readonly filteredModules = computed(() => {
    const query = this.normalize(this.search());
    return this.modules().filter(item => !query || this.normalize(`${item.name} ${item.websiteUrl ?? ''}`).includes(query));
  });
  readonly filteredAccounts = computed(() => {
    const query = this.normalize(this.search());
    return this.accounts().filter(item => !query || this.normalize(item.displayName).includes(query));
  });
  readonly unlocked = computed(() => !!this.unlockToken() && (this.unlockExpiresAt() ?? 0) > Date.now());

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private pendingAfterUnlock: (() => void) | null = null;
  private unlockTimer: number | null = null;

  constructor() { this.loadModules(); }

  ngOnDestroy(): void {
    this.lock(false);
    this.clearPlaintext();
  }

  loadModules(preferredId: number | null = this.selectedModuleId()): void {
    this.loadingModules.set(true);
    this.pageError.set('');
    this.api.passwordVaultModules().pipe(finalize(() => this.loadingModules.set(false))).subscribe({
      next: modules => {
        this.modules.set(modules);
        const selected = modules.find(item => item.id === preferredId)?.id ?? modules[0]?.id ?? null;
        if (selected !== this.selectedModuleId()) this.selectModule(selected);
        else if (selected !== null) this.loadAccounts(selected);
        else this.accounts.set([]);
      },
      error: error => this.pageError.set(this.errorMessage(error))
    });
  }

  selectModule(id: number | null): void {
    this.selectedModuleId.set(id);
    this.accounts.set([]);
    if (id !== null) this.loadAccounts(id);
  }

  loadAccounts(moduleId = this.selectedModuleId()): void {
    if (moduleId === null) return;
    this.loadingAccounts.set(true);
    this.api.passwordVaultAccounts(moduleId).pipe(finalize(() => this.loadingAccounts.set(false))).subscribe({
      next: accounts => this.accounts.set(accounts),
      error: error => this.pageError.set(this.errorMessage(error))
    });
  }

  openCreateModule(): void {
    this.editingModule.set(null);
    this.moduleDraft.set({name: '', websiteUrl: '', description: ''});
    this.moduleDialog.set(true);
  }

  openEditModule(module: PasswordVaultModule): void {
    this.editingModule.set(module);
    this.moduleDraft.set({name: module.name, websiteUrl: module.websiteUrl ?? '', description: module.description ?? ''});
    this.moduleDialog.set(true);
  }

  saveModule(): void {
    const draft = this.moduleDraft();
    if (!draft.name.trim()) return;
    const current = this.editingModule();
    const body = {name: draft.name.trim(), websiteUrl: this.nullable(draft.websiteUrl),
      description: this.nullable(draft.description)};
    const request = current
      ? this.api.updatePasswordVaultModule(current.id, {...body, version: current.version})
      : this.api.createPasswordVaultModule({...body, version: null});
    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: module => {
        this.moduleDialog.set(false);
        this.toast.show(this.i18n.t('passwordManager.moduleSaved'), 'success');
        this.loadModules(module.id);
      },
      error: error => this.pageError.set(this.errorMessage(error))
    });
  }

  deleteModule(module: PasswordVaultModule): void {
    if (!window.confirm(this.i18n.t('passwordManager.deleteModuleConfirm', {name: module.name, count: module.accountCount}))) return;
    this.actingId.set(module.id);
    this.api.deletePasswordVaultModule(module.id, module.version).pipe(finalize(() => this.actingId.set(null))).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('passwordManager.moduleDeleted'), 'success');
        this.selectedModuleId.set(null);
        this.loadModules(null);
      },
      error: error => this.pageError.set(this.errorMessage(error))
    });
  }

  openCreateAccount(): void {
    if (this.selectedModuleId() === null) return;
    this.editingAccount.set(null);
    this.accountDraft.set({displayName: '', username: '', password: '', loginUrl: '', note: ''});
    this.passwordLength.set(20);
    this.accountDialog.set(true);
  }

  openEditAccount(account: PasswordVaultAccount): void {
    this.withUnlock(() => this.fetchSecret(account, secret => {
      this.editingAccount.set(account);
      this.accountDraft.set({displayName: account.displayName, username: secret.username ?? '',
        password: secret.password ?? '', loginUrl: secret.loginUrl ?? '', note: secret.note ?? ''});
      this.accountDialog.set(true);
    }));
  }

  saveAccount(): void {
    const draft = this.accountDraft();
    if (!draft.displayName.trim() || !draft.password) return;
    const current = this.editingAccount();
    if (current && !this.validUnlock()) {
      this.withUnlock(() => this.saveAccount());
      return;
    }
    const body: PasswordVaultAccountRequest = {
      displayName: draft.displayName.trim(), username: this.nullable(draft.username), password: draft.password,
      loginUrl: this.nullable(draft.loginUrl), note: this.nullable(draft.note), version: current?.version ?? null
    };
    const moduleId = this.selectedModuleId();
    if (moduleId === null) return;
    const request = current
      ? this.api.updatePasswordVaultAccount(current.id, this.unlockToken()!, body)
      : this.api.createPasswordVaultAccount(moduleId, body);
    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.accountDialog.set(false);
        this.accountDraft.set({displayName: '', username: '', password: '', loginUrl: '', note: ''});
        this.toast.show(this.i18n.t('passwordManager.accountSaved'), 'success');
        this.loadModules(moduleId);
      },
      error: error => this.handleLocked(error, () => this.saveAccount())
    });
  }

  deleteAccount(account: PasswordVaultAccount): void {
    if (!window.confirm(this.i18n.t('passwordManager.deleteAccountConfirm', {name: account.displayName}))) return;
    this.actingId.set(account.id);
    this.api.deletePasswordVaultAccount(account.id, account.version).pipe(finalize(() => this.actingId.set(null))).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('passwordManager.accountDeleted'), 'success');
        this.loadModules(this.selectedModuleId());
      },
      error: error => this.pageError.set(this.errorMessage(error))
    });
  }

  reveal(account: PasswordVaultAccount): void {
    this.withUnlock(() => this.fetchSecret(account, secret => {
      this.revealedAccount.set(account);
      this.revealedSecret.set(secret);
    }));
  }

  copy(account: PasswordVaultAccount, field: 'USERNAME' | 'PASSWORD' | 'LOGIN_URL' | 'NOTE'): void {
    this.withUnlock(() => {
      const token = this.unlockToken();
      if (!token) return;
      this.api.passwordVaultSecret(account.id, token, {action: 'COPY', field}).subscribe({
        next: response => {
          if (response.value == null) return;
          navigator.clipboard.writeText(response.value).then(
            () => this.toast.show(this.i18n.t('passwordManager.copied'), 'success'),
            () => this.toast.show(this.i18n.t('passwordManager.copyFailed'), 'error'));
        },
        error: error => this.handleLocked(error, () => this.copy(account, field))
      });
    });
  }

  submitUnlock(): void {
    if (!this.unlockPassword()) return;
    this.unlocking.set(true);
    this.api.unlockPasswordVault(this.unlockPassword()).pipe(finalize(() => this.unlocking.set(false))).subscribe({
      next: response => {
        this.pageError.set('');
        this.unlockToken.set(response.unlockToken);
        this.unlockExpiresAt.set(new Date(response.expiresAt).getTime());
        this.unlockPassword.set('');
        this.unlockDialog.set(false);
        this.scheduleLock();
        const action = this.pendingAfterUnlock;
        this.pendingAfterUnlock = null;
        action?.();
      },
      error: error => this.pageError.set(this.errorMessage(error))
    });
  }

  cancelUnlock(): void {
    this.unlockPassword.set('');
    this.unlockDialog.set(false);
    this.pendingAfterUnlock = null;
  }

  lock(notify = true): void {
    const token = this.unlockToken();
    if (token) this.api.lockPasswordVault(token).subscribe({error: () => undefined});
    if (this.unlockTimer !== null) window.clearTimeout(this.unlockTimer);
    this.unlockTimer = null;
    this.unlockToken.set(null);
    this.unlockExpiresAt.set(null);
    this.clearPlaintext();
    if (notify) this.toast.show(this.i18n.t('passwordManager.locked'));
  }

  closeAccountDialog(): void {
    this.accountDialog.set(false);
    this.accountDraft.set({displayName: '', username: '', password: '', loginUrl: '', note: ''});
  }

  closeReveal(): void {
    this.revealedAccount.set(null);
    this.revealedSecret.set(null);
  }

  generatePassword(): void {
    const sets = [
      this.useUpper() ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : '',
      this.useLower() ? 'abcdefghijkmnopqrstuvwxyz' : '',
      this.useDigits() ? '23456789' : '',
      this.useSymbols() ? '!@#$%^&*()-_=+[]{};:,.?' : ''
    ].filter(Boolean);
    if (!sets.length) return;
    const length = Math.max(16, Math.min(64, Number(this.passwordLength()) || 20));
    const all = sets.join('');
    const chars = sets.map(set => set[this.randomIndex(set.length)]);
    while (chars.length < length) chars.push(all[this.randomIndex(all.length)]);
    for (let index = chars.length - 1; index > 0; index--) {
      const swap = this.randomIndex(index + 1);
      [chars[index], chars[swap]] = [chars[swap], chars[index]];
    }
    this.passwordLength.set(length);
    this.accountDraft.update(value => ({...value, password: chars.join('')}));
  }

  private fetchSecret(account: PasswordVaultAccount, next: (secret: PasswordVaultSecret) => void): void {
    const token = this.unlockToken();
    if (!token) return;
    this.actingId.set(account.id);
    this.api.passwordVaultSecret(account.id, token, {action: 'REVEAL'})
      .pipe(finalize(() => this.actingId.set(null))).subscribe({
        next,
        error: error => this.handleLocked(error, () => this.fetchSecret(account, next))
      });
  }

  private withUnlock(action: () => void): void {
    if (this.validUnlock()) { action(); return; }
    this.expireUnlock();
    this.pendingAfterUnlock = action;
    this.unlockDialog.set(true);
  }

  private validUnlock(): boolean {
    return !!this.unlockToken() && (this.unlockExpiresAt() ?? 0) > Date.now();
  }

  private scheduleLock(): void {
    if (this.unlockTimer !== null) window.clearTimeout(this.unlockTimer);
    const delay = Math.max(0, (this.unlockExpiresAt() ?? Date.now()) - Date.now());
    this.unlockTimer = window.setTimeout(() => this.lock(false), delay);
  }

  private expireUnlock(): void {
    if (this.unlockTimer !== null) window.clearTimeout(this.unlockTimer);
    this.unlockTimer = null;
    this.unlockToken.set(null);
    this.unlockExpiresAt.set(null);
    this.clearPlaintext();
  }

  private handleLocked(error: unknown, retry: () => void): void {
    if (error instanceof HttpErrorResponse && error.error?.code === 'VAULT_LOCKED') {
      this.expireUnlock();
      this.pendingAfterUnlock = retry;
      this.unlockDialog.set(true);
      return;
    }
    this.pageError.set(this.errorMessage(error));
  }

  private clearPlaintext(): void {
    this.closeReveal();
    if (this.accountDialog()) this.closeAccountDialog();
  }

  private randomIndex(max: number): number {
    const limit = Math.floor(0x100000000 / max) * max;
    const value = new Uint32Array(1);
    do crypto.getRandomValues(value); while (value[0] >= limit);
    return value[0] % max;
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }
  private nullable(value: string): string | null { return value.trim() || null; }
  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') return error.error.message;
    return this.i18n.t('passwordManager.actionFailed');
  }
}

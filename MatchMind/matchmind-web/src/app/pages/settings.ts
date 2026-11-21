import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { API, ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError, apiErrorText } from '../core/http';
import { Page, User, UserAuditRow } from '../core/models';
import { safeValue } from '../core/resource';
import { CopyFallback, CopyService } from '../shared/copy';
import { fmtDateTime, humanize } from '../shared/format';
import { ConfirmService, Dialog, Paginator, ToastService } from '../shared/kit';
import { ResultTag } from '../shared/ui';

const matchNew = (g: AbstractControl): ValidationErrors | null =>
  g.get('newPassword')?.value === g.get('confirm')?.value ? null : { mismatch: true };

/** UX-031: the server policy (API_DOCUMENTATION "Passwords"), said before the user types. */
const PASSWORD_RULES = '10 to 72 characters. Not your username, not one repeated character or pattern, not a simple sequence (1234567890, abcdefghij), not a common password.';
const AUDIT_SIZE = 10;

@Component({
  selector: 'mm-settings',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, Dialog, Paginator, ResultTag, CopyFallback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (auth.user()?.mustChangePassword) {
        <div class="alert alert-warn" role="alert" data-testid="must-change">
          <i class="pi pi-lock" aria-hidden="true"></i> An admin gave you a temporary password. Choose a new password below to continue.
        </div>
      }
      <div class="grid-2 align-start">
        <section class="panel">
          <header><h2>Your account</h2></header>
          <dl class="dl">
            <dt>Username</dt><dd>{{ auth.user()?.username }}</dd>
            <dt>Role</dt><dd>{{ humanize(auth.user()?.role) }}</dd>
            <dt>Last sign-in</dt><dd>{{ fmt(account()?.lastLoginAt ?? auth.user()?.lastLoginAt) }}</dd>
          </dl>
          <div class="row mt-2">
            <button type="button" class="btn btn-outline btn-sm" (click)="signOutEverywhere()" data-testid="logout-all">
              <i class="pi pi-sign-out" aria-hidden="true"></i> Sign out everywhere</button>
          </div>
          <small class="muted-text">Sign out in the menu ends the session in this browser only. Sign out everywhere also ends it on your other devices.</small>
        </section>
        <section class="panel">
          <header><h2>Change password</h2></header>
          <form class="stack" [formGroup]="pw" (ngSubmit)="changePassword()">
            <input type="text" hidden autocomplete="username" [value]="auth.user()?.username ?? ''" aria-hidden="true" tabindex="-1" />
            <div class="field"><label for="cur">Current password</label>
              <input class="input w-full" type="password" id="cur" formControlName="currentPassword" autocomplete="current-password" /></div>
            <div class="field"><label for="new">New password</label>
              <input class="input w-full" type="password" id="new" formControlName="newPassword" autocomplete="new-password" aria-describedby="new-rules" />
              <small id="new-rules" class="muted-text">{{ rules }} It must differ from the current one.</small></div>
            <div class="field"><label for="confirm">Confirm new password</label>
              <input class="input w-full" type="password" id="confirm" formControlName="confirm" autocomplete="new-password" />
              @if (pw.hasError('mismatch') && pw.controls.confirm.touched) { <div class="field-error">The passwords don't match.</div> }</div>
            @if (pwError()) { <div class="field-error" role="alert">{{ pwError() }}</div> }
            <div><button type="submit" class="btn btn-primary" [disabled]="pw.invalid || busy()">
              @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Change password</button></div>
            <small class="muted-text">Changing your password signs you out everywhere.</small>
          </form>
        </section>
      </div>

      <section class="panel" data-testid="connect-agent">
        <header><h2>Connect an agent</h2></header>
        <p class="muted-text">An agent that can make HTTP calls sends each prediction itself. Agents without internet reply
          <code>CANNOT_CALL_API</code> instead: paste that reply into <a routerLink="/import">Import prediction</a>.</p>
        <dl class="dl mt-2">
          <dt>Endpoint</dt>
          <dd><code>POST {{ endpoint }}</code>
            <button type="button" class="btn btn-text btn-sm" (click)="clipboard.copy(endpoint, 'Endpoint')"><i class="pi pi-copy" aria-hidden="true"></i> Copy</button></dd>
          <dt>Test</dt><dd><code>GET {{ ping }}</code> (no key needed)</dd>
          <dt><code>X-Api-Key</code></dt><dd>The provider's own key (<code>mmk_…</code>), issued once on <a routerLink="/providers">Providers</a>.
            The legacy shared key (<code>EXTERNAL_API_KEY</code> in the server's <code>.env</code>) still works until the cut-over.</dd>
          <dt><code>X-Provider</code></dt><dd>Who is calling, e.g. <code>chatgpt</code>: 2–64 of a-z, 0-9, - and _. Needed only with the shared key; a provider key already names its provider.</dd>
          <dt><code>X-Model-Name</code></dt><dd>The model, e.g. <code>gpt-5.1</code>. Wins over <code>model</code> in the JSON.</dd>
          <dt><code>X-Model-Version</code></dt><dd>Optional, default <code>1</code>.</dd>
        </dl>
        <p class="muted-text mt-2">The prompts in <a routerLink="/prompts">Prompt Notes</a> already contain all of this: their Copy button
          fills in the URL{{ auth.isAdmin() ? ' and the key' : '' }}. Field rules: <code>docs/API_DOCUMENTATION.md</code>.</p>
      </section>

      @if (auth.isAdmin()) {
        <section class="panel flush">
          <header><h2>Users</h2>
            <div class="row">
              <input class="input input-sm" type="search" placeholder="Search users" aria-label="Search users" [ngModel]="userSearch()" (ngModelChange)="userSearch.set($event)" />
              <select class="input input-sm" data-testid="user-status" aria-label="Status" [value]="userStatus()" (change)="userStatus.set($any($event.target).value)">
                <option value="">All</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option>
              </select>
              <button type="button" class="btn btn-primary btn-sm" (click)="openCreate()"><i class="pi pi-user-plus"></i> Add user</button>
            </div>
          </header>
          <p class="scroll-hint muted-text" aria-hidden="true">Swipe the table sideways for more columns; actions stay on the right.</p>
          <div class="table-wrap tall users-table"><table class="dt">
            <thead><tr><th>Username</th><th>Role</th><th>Status</th><th class="hide-sm">Last sign-in</th><th class="hide-sm">Created</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              @for (u of shownUsers(); track u.id) {
              <tr>
                <td>{{ u.username }}@if (u.id === auth.user()?.id) { <span class="cell-sub">You</span> }</td>
                <td><select class="input input-sm" [value]="u.role" (change)="setRole(u, $event)" [disabled]="u.id === auth.user()?.id" [attr.aria-label]="'Role of ' + u.username">
                  @for (r of roles; track r) { <option [value]="r" [selected]="r === u.role">{{ humanize(r) }}</option> }
                </select></td>
                <td class="nowrap"><mm-result [value]="u.status" kind="status" />
                  @if (u.loginLocked) { <span class="tag tag-warn" title="Too many failed sign-ins">Locked</span> }
                  @if (u.mustChangePassword) { <span class="tag tag-info" title="Must choose a new password at the next sign-in">Temporary password</span> }</td>
                <td class="nowrap hide-sm">{{ fmt(u.lastLoginAt) }}</td><td class="nowrap hide-sm">{{ fmt(u.createdAt) }}</td>
                <td class="nowrap actions">
                  @if (u.id !== auth.user()?.id) {
                    @if (u.loginLocked) { <button type="button" class="btn btn-text btn-sm" (click)="unlock(u)" [attr.data-testid]="'unlock-' + u.id">Unlock</button> }
                    <button type="button" class="btn btn-text btn-sm" [class.danger]="u.status === 'ACTIVE'" (click)="toggleStatus(u)">{{ u.status === 'ACTIVE' ? 'Disable' : 'Enable' }}</button>
                    <button type="button" class="btn btn-text btn-sm" (click)="openReset(u)">Reset password</button>
                  }
                </td>
              </tr>
              } @empty { <tr><td colspan="6" class="muted-text">No user matches these filters.</td></tr> }
            </tbody>
          </table></div>
        </section>

        <section class="panel flush" data-testid="user-audit">
          <header><h2>Account changes</h2></header>
          <div class="table-wrap"><table class="dt">
            <thead><tr><th>When</th><th>Who</th><th>Account</th><th>Change</th><th class="hide-sm">IP</th></tr></thead>
            <tbody>
              @for (a of audit()?.data ?? []; track a.id) {
                <tr><td class="nowrap">{{ fmt(a.at) }}</td><td>{{ a.actor ?? '—' }}</td><td>{{ a.target }}</td>
                  <td>{{ humanize(a.action) }}@if (a.oldValue || a.newValue) { : {{ humanize(a.oldValue) }} → {{ humanize(a.newValue) }} }</td>
                  <td class="hide-sm">{{ a.clientIp ?? '—' }}</td></tr>
              } @empty { <tr><td colspan="5" class="muted-text">No account changes yet.</td></tr> }
            </tbody>
          </table></div>
          @if ((audit()?.meta?.totalElements ?? 0) > auditSize) {
            <mm-paginator [page]="audit()!.meta.page" [size]="auditSize" [sizes]="[auditSize]" [total]="audit()!.meta.totalElements" unit="changes" (pageChange)="loadAudit($event.page)" />
          }
        </section>
      }
    </div>

    <mm-dialog [open]="dialog() !== null" [busy]="busy()" (closed)="closeDialog()" width="min(460px, 95vw)"
      [header]="dialog() === 'create' ? 'Add user' : 'Reset password for ' + resetTarget()?.username">
      <form class="stack" (ngSubmit)="submitDialog()">
        @if (dialog() === 'create') {
          <div class="field"><label for="nu-name">Username</label><input class="input w-full" id="nu-name" name="username" [(ngModel)]="newUsername" maxlength="64" autocomplete="off" />
            <small class="muted-text">3–64 letters, digits, ".", "_" or "-".</small></div>
          <div class="field"><label for="nu-role">Role</label>
            <select class="input w-full" id="nu-role" name="role" [(ngModel)]="newRole">@for (r of roles; track r) { <option [value]="r">{{ humanize(r) }}</option> }</select></div>
        }
        <div class="field"><label for="nu-pass">{{ dialog() === 'create' ? 'Initial password' : 'New password' }}</label>
          <div class="pass-row">
            <input class="input w-full mono" [type]="showNewPassword() ? 'text' : 'password'" id="nu-pass" name="password" [(ngModel)]="newPassword"
              autocomplete="new-password" spellcheck="false" aria-describedby="nu-rules" />
            <button type="button" class="btn btn-text btn-icon" [attr.aria-label]="showNewPassword() ? 'Hide password' : 'Show password'"
              [attr.aria-pressed]="showNewPassword()" (click)="showNewPassword.set(!showNewPassword())">
              <i class="pi" [class.pi-eye]="!showNewPassword()" [class.pi-eye-slash]="showNewPassword()" aria-hidden="true"></i></button>
          </div>
          <div class="row">
            <button type="button" class="btn btn-outline btn-sm" (click)="generate()" [disabled]="generating()"><i class="pi pi-sparkles" aria-hidden="true"></i> Generate</button>
            @if (newPassword()) { <button type="button" class="btn btn-text btn-sm" (click)="clipboard.copy(newPassword(), 'Password')"><i class="pi pi-copy" aria-hidden="true"></i> Copy</button> }
          </div>
          <small id="nu-rules" class="muted-text">{{ rules }} It is shown only here: share it with the user over a secure channel.</small></div>
        <label class="check"><input type="checkbox" name="mustChange" [(ngModel)]="mustChange" /> Ask for a new password at the first sign-in</label>
        @if (dialogError()) { <div class="field-error" role="alert">{{ dialogError() }}</div> }
        <div class="dialog-actions">
          <button type="button" class="btn btn-text" (click)="closeDialog()">Cancel</button>
          <button type="submit" class="btn btn-primary"
            [disabled]="busy() || newPassword().length < 10 || newPassword().length > 72 || (dialog() === 'create' && !usernameValid())">
            @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } {{ dialog() === 'create' ? 'Add user' : 'Reset password' }}</button>
        </div>
      </form>
    </mm-dialog>
    <mm-copy-fallback />`,
  styles: `
    .pass-row { display: flex; gap: .25rem; align-items: center; }
    .mono { font-family: var(--mm-mono); }
    .scroll-hint { display: none; padding: 0 1rem .5rem; font-size: var(--fs-xs); }
    .users-table th.actions, .users-table td.actions { position: sticky; right: 0; background: var(--mm-card); box-shadow: -8px 0 8px -8px rgba(15, 27, 51, .25); }
    @media (max-width: 640px) {
      .scroll-hint { display: block; }
      .users-table td.actions .btn { min-height: 40px; }
      select.input, input.input { font-size: 16px; }
    }`,
})
export class SettingsPage {
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly clipboard = inject(CopyService);
  readonly auth = inject(AuthService);
  /** '' = everyone; ACTIVE or DISABLED is filtered by the API (`?status=`). */
  readonly userStatus = signal('');
  private readonly usersRes = this.api.usersResource(() => this.auth.isAdmin(), () => this.userStatus());
  readonly users = safeValue(this.usersRes, []);
  readonly userSearch = signal('');
  /** GET /users is not paged: the search filters the loaded list. */
  readonly shownUsers = computed(() => {
    const q = this.userSearch().trim().toLowerCase();
    return q ? this.users().filter(u => u.username.toLowerCase().includes(q)) : this.users();
  });
  /** Fresh from /auth/me, so "Last sign-in" matches the Users table (the session copy is from sign-in time). */
  readonly account = signal<User | null>(null);
  readonly audit = signal<Page<UserAuditRow> | null>(null);
  readonly auditSize = AUDIT_SIZE;
  readonly busy = signal(false);
  readonly generating = signal(false);
  readonly pwError = signal('');
  readonly dialog = signal<'create' | 'reset' | null>(null);
  readonly dialogError = signal('');
  readonly roles = ['ADMIN', 'VIEWER'];
  readonly rules = PASSWORD_RULES;
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly ping = `${location.origin}${API}/external/ping`;
  readonly endpoint = `${location.origin}${API}/external/predictions`;
  readonly resetTarget = signal<User | null>(null);
  readonly newUsername = signal('');
  readonly newRole = signal('VIEWER');
  readonly newPassword = signal('');
  readonly showNewPassword = signal(false);
  readonly mustChange = signal(true);

  readonly pw = inject(FormBuilder).nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(72)]],
    confirm: ['', Validators.required],
  }, { validators: matchNew });

  constructor() {
    effect(() => {
      const e = this.usersRes.error();
      if (e) this.messages.add({ severity: 'error', summary: 'Could not load users', detail: apiError(e).message });
    });
    this.api.me().subscribe({ next: u => this.account.set(u), error: () => undefined });
    if (this.auth.isAdmin()) this.loadAudit(0);
  }

  loadUsers(): void { this.usersRes.reload(); }

  loadAudit(page: number): void {
    this.api.userAudit({ page, size: AUDIT_SIZE }).subscribe({ next: p => this.audit.set(p), error: () => undefined });
  }

  async signOutEverywhere(): Promise<void> {
    const ok = await this.confirm.ask({ header: 'Sign out everywhere?', acceptLabel: 'Sign out everywhere', danger: true,
      message: 'This ends your sessions on every device and browser, including this one. Unsaved work in other tabs is lost.' });
    if (ok) this.auth.logoutAll();
  }

  changePassword(): void {
    if (this.pw.invalid || this.busy()) return;
    const v = this.pw.getRawValue();
    this.busy.set(true);
    this.pwError.set('');
    this.api.changePassword(v.currentPassword, v.newPassword).subscribe({
      next: () => {
        this.busy.set(false);
        this.messages.add({ severity: 'success', summary: 'Password changed', detail: 'Sign in again with your new password.' });
        this.auth.expire(); // every token of this user was revoked server-side
      },
      // WEAK_PASSWORD / PASSWORD_UNCHANGED / BAD_CURRENT_PASSWORD / 429 after 5 wrong tries: message plus field errors.
      error: e => { this.busy.set(false); this.pwError.set(apiErrorText(e)); },
    });
  }

  /** Role changes apply at once, also to the user's open sessions: confirm first. */
  async setRole(u: User, e: Event): Promise<void> {
    const select = e.target as HTMLSelectElement;
    const role = select.value;
    const ok = await this.confirm.ask({
      header: `Make ${u.username} ${humanize(role).toLowerCase()}?`, acceptLabel: `Make ${humanize(role).toLowerCase()}`, danger: role === 'ADMIN',
      message: role === 'ADMIN'
        ? `${u.username} will be able to change data, prompts and users, starting with their current session.`
        : `${u.username} will only be able to read, starting with their current session.`,
    });
    if (!ok) { select.value = u.role; return; }
    this.update(u, { role }, `Role changed`, `${u.username} is now ${humanize(role).toLowerCase()}.`, select);
  }

  async toggleStatus(u: User): Promise<void> {
    const disable = u.status === 'ACTIVE';
    if (disable && !await this.confirm.ask({ header: `Disable ${u.username}?`, acceptLabel: 'Disable', danger: true,
      message: `${u.username} is signed out at once and cannot sign in until enabled again.` })) return;
    this.update(u, { status: disable ? 'DISABLED' : 'ACTIVE' }, disable ? 'User disabled' : 'User enabled', u.username);
  }

  unlock(u: User): void {
    this.api.unlockUser(u.id).subscribe({
      next: () => {
        this.usersRes.update(list => list?.map(x => x.id === u.id ? { ...x, loginLocked: false } : x));
        this.messages.add({ severity: 'success', summary: 'User unlocked', detail: `${u.username} can sign in again.` });
        this.loadAudit(0);
      },
      error: e => this.messages.add({ severity: 'error', summary: 'Unlock failed', detail: apiError(e).message }),
    });
  }

  private update(u: User, body: { role?: string; status?: string }, summary: string, detail: string, roleSelect?: HTMLSelectElement): void {
    this.api.updateUser(u.id, body).subscribe({
      next: updated => {
        this.usersRes.update(list => list?.map(x => x.id === updated.id ? updated : x));
        this.messages.add({ severity: 'success', summary, detail });
        this.loadAudit(0);
      },
      error: e => {
        // The reloaded role equals the bound one, so Angular would not reset the control by itself.
        if (roleSelect) roleSelect.value = u.role;
        this.messages.add({ severity: 'error', summary: 'Update failed', detail: apiError(e).message });
        this.loadUsers();
      },
    });
  }

  readonly usernameValid = computed(() => /^[A-Za-z0-9._-]{3,64}$/.test(this.newUsername().trim()));

  private resetDialog(): void {
    this.newPassword.set(''); this.showNewPassword.set(false); this.mustChange.set(true); this.dialogError.set('');
  }

  openCreate(): void { this.resetDialog(); this.newUsername.set(''); this.newRole.set('VIEWER'); this.dialog.set('create'); }

  openReset(u: User): void { this.resetDialog(); this.resetTarget.set(u); this.dialog.set('reset'); }

  /** The generated password lives only in this dialog: cleared on close, never logged or put in a URL. */
  closeDialog(): void { this.resetDialog(); this.dialog.set(null); }

  generate(): void {
    this.generating.set(true);
    this.api.generatePassword().subscribe({
      next: r => { this.generating.set(false); this.newPassword.set(r.password); this.showNewPassword.set(true); },
      error: e => { this.generating.set(false); this.dialogError.set(apiError(e).message); },
    });
  }

  submitDialog(): void {
    if (this.busy()) return; // a double click must not send twice (UX-109)
    this.busy.set(true);
    this.dialogError.set('');
    const creating = this.dialog() === 'create';
    const call: Observable<unknown> = creating
      ? this.api.createUser({ username: this.newUsername().trim(), password: this.newPassword(), role: this.newRole(), mustChangePassword: this.mustChange() })
      : this.api.resetPassword(this.resetTarget()!.id, this.newPassword(), this.mustChange());
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.messages.add({ severity: 'success', summary: creating ? 'User added' : 'Password reset' });
        this.closeDialog();
        this.loadUsers();
        this.loadAudit(0);
      },
      error: e => { this.busy.set(false); this.dialogError.set(apiErrorText(e)); },
    });
  }
}

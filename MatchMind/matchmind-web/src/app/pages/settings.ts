import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { User } from '../core/models';
import { safeValue } from '../core/resource';
import { fmtDateTime, humanize } from '../shared/format';
import { Dialog, ToastService } from '../shared/kit';
import { ResultTag } from '../shared/ui';

const matchNew = (g: AbstractControl): ValidationErrors | null =>
  g.get('newPassword')?.value === g.get('confirm')?.value ? null : { mismatch: true };

@Component({
  selector: 'mm-settings',
  imports: [ReactiveFormsModule, FormsModule, Dialog, ResultTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <div class="grid-2 align-start">
        <section class="panel">
          <header><h2>Your account</h2></header>
          <dl class="dl">
            <dt>Username</dt><dd>{{ auth.user()?.username }}</dd>
            <dt>Role</dt><dd>{{ humanize(auth.user()?.role) }}</dd>
            <dt>Last sign-in</dt><dd>{{ fmt(auth.user()?.lastLoginAt) }}</dd>
          </dl>
        </section>
        <section class="panel">
          <header><h2>Change password</h2></header>
          <form class="stack" [formGroup]="pw" (ngSubmit)="changePassword()">
            <input type="text" hidden autocomplete="username" [value]="auth.user()?.username ?? ''" aria-hidden="true" tabindex="-1" />
            <div class="field"><label for="cur">Current password</label>
              <input class="input w-full" type="password" id="cur" formControlName="currentPassword" autocomplete="current-password" /></div>
            <div class="field"><label for="new">New password</label>
              <input class="input w-full" type="password" id="new" formControlName="newPassword" autocomplete="new-password" />
              <small class="muted-text">10 to 72 characters.</small></div>
            <div class="field"><label for="confirm">Confirm new password</label>
              <input class="input w-full" type="password" id="confirm" formControlName="confirm" autocomplete="new-password" />
              @if (pw.hasError('mismatch') && pw.controls.confirm.touched) { <div class="field-error">The passwords don't match.</div> }</div>
            @if (pwError()) { <div class="field-error">{{ pwError() }}</div> }
            <div><button type="submit" class="btn btn-primary" [disabled]="pw.invalid || busy()">
              @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Change password</button></div>
            <small class="muted-text">Changing your password signs you out everywhere.</small>
          </form>
        </section>
      </div>

      @if (auth.isAdmin()) {
        <section class="panel flush">
          <header><h2>Users</h2><button type="button" class="btn btn-primary btn-sm" (click)="openCreate()"><i class="pi pi-user-plus"></i> Add user</button></header>
          <div class="table-wrap tall"><table class="dt">
            <thead><tr><th>Username</th><th>Role</th><th>Status</th><th class="hide-sm">Last sign-in</th><th class="hide-sm">Created</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              @for (u of users(); track u.id) {
              <tr>
                <td>{{ u.username }}@if (u.id === auth.user()?.id) { <span class="cell-sub">You</span> }</td>
                <td><select class="input input-sm" [value]="u.role" (change)="setRole(u, $event)" [disabled]="u.id === auth.user()?.id" [attr.aria-label]="'Role of ' + u.username">
                  @for (r of roles; track r) { <option [value]="r" [selected]="r === u.role">{{ humanize(r) }}</option> }
                </select></td>
                <td><mm-result [value]="u.status" kind="status" /></td>
                <td class="nowrap hide-sm">{{ fmt(u.lastLoginAt) }}</td><td class="nowrap hide-sm">{{ fmt(u.createdAt) }}</td>
                <td class="nowrap">
                  @if (u.id !== auth.user()?.id) {
                    <button type="button" class="btn btn-text btn-sm" [class.danger]="u.status === 'ACTIVE'"
                      (click)="update(u, { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })">{{ u.status === 'ACTIVE' ? 'Disable' : 'Enable' }}</button>
                    <button type="button" class="btn btn-text btn-sm" (click)="openReset(u)">Reset password</button>
                  }
                </td>
              </tr>
              }
            </tbody>
          </table></div>
        </section>
      }
    </div>

    <mm-dialog [open]="dialog() !== null" (closed)="dialog.set(null)" width="min(440px, 95vw)"
      [header]="dialog() === 'create' ? 'Add user' : 'Reset password for ' + resetTarget()?.username">
      <form class="stack" (ngSubmit)="submitDialog()">
        @if (dialog() === 'create') {
          <div class="field"><label for="nu-name">Username</label><input class="input w-full" id="nu-name" name="username" [(ngModel)]="newUsername" maxlength="64" autocomplete="off" />
            <small class="muted-text">3–64 letters, digits, ".", "_" or "-".</small></div>
          <div class="field"><label for="nu-role">Role</label>
            <select class="input w-full" id="nu-role" name="role" [(ngModel)]="newRole">@for (r of roles; track r) { <option [value]="r">{{ humanize(r) }}</option> }</select></div>
        }
        <div class="field"><label for="nu-pass">{{ dialog() === 'create' ? 'Initial password' : 'New password' }}</label>
          <input class="input w-full" type="password" id="nu-pass" name="password" [(ngModel)]="newPassword" autocomplete="new-password" />
          <small class="muted-text">10 to 72 characters. Share it with the user over a secure channel.</small></div>
        @if (dialogError()) { <div class="field-error">{{ dialogError() }}</div> }
        <div class="dialog-actions">
          <button type="button" class="btn btn-text" (click)="dialog.set(null)">Cancel</button>
          <button type="submit" class="btn btn-primary"
            [disabled]="busy() || newPassword().length < 10 || newPassword().length > 72 || (dialog() === 'create' && !usernameValid())">
            @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } {{ dialog() === 'create' ? 'Add user' : 'Reset password' }}</button>
        </div>
      </form>
    </mm-dialog>`,
})
export class SettingsPage {
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
  readonly auth = inject(AuthService);
  private readonly usersRes = this.api.usersResource(() => this.auth.isAdmin());
  readonly users = safeValue(this.usersRes, []);
  readonly busy = signal(false);
  readonly pwError = signal('');
  readonly dialog = signal<'create' | 'reset' | null>(null);
  readonly dialogError = signal('');
  readonly roles = ['ADMIN', 'VIEWER'];
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly resetTarget = signal<User | null>(null);
  readonly newUsername = signal('');
  readonly newRole = signal('VIEWER');
  readonly newPassword = signal('');

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
  }

  loadUsers(): void { this.usersRes.reload(); }

  changePassword(): void {
    if (this.pw.invalid) return;
    const v = this.pw.getRawValue();
    this.busy.set(true);
    this.pwError.set('');
    this.api.changePassword(v.currentPassword, v.newPassword).subscribe({
      next: () => {
        this.busy.set(false);
        this.messages.add({ severity: 'success', summary: 'Password changed', detail: 'Sign in again with your new password.' });
        this.auth.expire(); // every token of this user was revoked server-side
      },
      error: e => { this.busy.set(false); this.pwError.set(apiError(e).message); },
    });
  }

  setRole(u: User, e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.update(u, { role: select.value }, select);
  }

  update(u: User, body: { role?: string; status?: string }, roleSelect?: HTMLSelectElement): void {
    this.api.updateUser(u.id, body).subscribe({
      next: updated => this.usersRes.update(list => list?.map(x => x.id === updated.id ? updated : x)),
      error: e => {
        // The reloaded role equals the bound one, so Angular would not reset the control by itself.
        if (roleSelect) roleSelect.value = u.role;
        this.messages.add({ severity: 'error', summary: 'Update failed', detail: apiError(e).message });
        this.loadUsers();
      },
    });
  }

  readonly usernameValid = computed(() => /^[A-Za-z0-9._-]{3,64}$/.test(this.newUsername().trim()));

  openCreate(): void { this.newUsername.set(''); this.newRole.set('VIEWER'); this.newPassword.set(''); this.dialogError.set(''); this.dialog.set('create'); }

  openReset(u: User): void { this.resetTarget.set(u); this.newPassword.set(''); this.dialogError.set(''); this.dialog.set('reset'); }

  submitDialog(): void {
    this.busy.set(true);
    const call: Observable<unknown> = this.dialog() === 'create'
      ? this.api.createUser({ username: this.newUsername().trim(), password: this.newPassword(), role: this.newRole() })
      : this.api.resetPassword(this.resetTarget()!.id, this.newPassword());
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.messages.add({ severity: 'success', summary: this.dialog() === 'create' ? 'User added' : 'Password reset' });
        this.newPassword.set('');
        this.dialog.set(null);
        this.loadUsers();
      },
      error: e => { this.busy.set(false); this.dialogError.set(apiError(e).message); },
    });
  }
}

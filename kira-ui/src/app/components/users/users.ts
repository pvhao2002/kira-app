import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {DatePipe, DecimalPipe} from '@angular/common';
import {HttpClient, HttpParams} from '@angular/common/http';
import {RouterLink} from '@angular/router';

export interface UserRow {
  userId: number;
  username: string;
  status: string;
  role: string;
  avatar: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UserPage {
  content: UserRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type StatusFilter = 'all' | 'active' | 'locked' | 'pending';

function errMsg(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  const m = e?.error?.message ?? e?.message;
  return typeof m === 'string' ? m : 'An error occurred.';
}

@Component({
  selector: 'app-users',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './users.html',
  styleUrl: './users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Users {
  private readonly http = inject(HttpClient);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<UserPage | null>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly draftQ = signal('');
  readonly appliedQ = signal('');
  readonly statusFilter = signal<StatusFilter>('all');

  readonly mutatingId = signal<number | null>(null);
  readonly mutateError = signal<string | null>(null);

  readonly modalMode = signal<'create' | 'edit' | 'password' | null>(null);
  readonly editingUser = signal<UserRow | null>(null);

  readonly createUsername = signal('');
  readonly createPassword = signal('');
  readonly createRole = signal('user');

  readonly editRole = signal('user');
  readonly editStatus = signal('active');

  readonly resetPasswordValue = signal('');

  readonly modalError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  initials(username: string): string {
    const t = username.trim();
    if (!t) {
      return '?';
    }
    return t.slice(0, 2).toUpperCase();
  }

  statusLabel(status: string | null | undefined): string {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'enabled') {
      return 'Active';
    }
    if (s === 'locked') {
      return 'Locked';
    }
    if (s === 'pending') {
      return 'Pending';
    }
    return status || '—';
  }

  isLockedStatus(status: string | null | undefined): boolean {
    return (status || '').toLowerCase() === 'locked';
  }

  applySearch(): void {
    this.appliedQ.set(this.draftQ().trim());
    this.pageIndex.set(0);
    this.load();
  }

  setStatusFilter(mode: StatusFilter): void {
    this.statusFilter.set(mode);
    this.pageIndex.set(0);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.mutateError.set(null);

    let params = new HttpParams()
      .set('page', String(this.pageIndex()))
      .set('size', String(this.pageSize()));

    const q = this.appliedQ();
    if (q) {
      params = params.set('q', q);
    }
    const st = this.statusFilter();
    if (st !== 'all') {
      params = params.set('status', st);
    }

    this.http.get<UserPage>('/gateway/users', {params}).subscribe({
      next: body => {
        this.data.set(body);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(errMsg(err));
        this.loading.set(false);
      },
    });
  }

  prev(): void {
    if (this.pageIndex() <= 0) {
      return;
    }
    this.pageIndex.update(p => p - 1);
    this.load();
  }

  next(): void {
    const d = this.data();
    if (!d || this.pageIndex() >= d.totalPages - 1) {
      return;
    }
    this.pageIndex.update(p => p + 1);
    this.load();
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.editingUser.set(null);
    this.modalError.set(null);
    this.createUsername.set('');
    this.createPassword.set('');
    this.createRole.set('user');
    this.editRole.set('user');
    this.editStatus.set('active');
    this.resetPasswordValue.set('');
  }

  openCreate(): void {
    this.modalError.set(null);
    this.createUsername.set('');
    this.createPassword.set('');
    this.createRole.set('user');
    this.modalMode.set('create');
  }

  submitCreate(): void {
    const u = this.createUsername().trim();
    const p = this.createPassword();
    if (!u || p.length < 6) {
      this.modalError.set('Enter a username and a password with at least 6 characters.');
      return;
    }
    this.modalError.set(null);
    this.mutatingId.set(-1);
    this.http
      .post<UserRow>('/gateway/users', {
        username: u,
        password: p,
        role: this.createRole(),
      })
      .subscribe({
        next: () => {
          this.mutatingId.set(null);
          this.closeModal();
          this.load();
        },
        error: err => {
          this.mutatingId.set(null);
          this.modalError.set(errMsg(err));
        },
      });
  }

  openEdit(row: UserRow): void {
    this.modalError.set(null);
    this.editingUser.set(row);
    this.editRole.set((row.role || 'user').toLowerCase());
    const st = (row.status || 'active').toLowerCase();
    this.editStatus.set(st === 'enabled' ? 'active' : st === 'locked' || st === 'pending' ? st : 'active');
    this.modalMode.set('edit');
  }

  submitEdit(): void {
    const row = this.editingUser();
    if (!row) {
      return;
    }
    this.modalError.set(null);
    this.mutatingId.set(row.userId);
    this.http
      .patch<UserRow>(`/gateway/users/${row.userId}`, {
        role: this.editRole(),
        status: this.editStatus(),
      })
      .subscribe({
        next: () => {
          this.mutatingId.set(null);
          this.closeModal();
          this.load();
        },
        error: err => {
          this.mutatingId.set(null);
          this.modalError.set(errMsg(err));
        },
      });
  }

  openResetPassword(row: UserRow): void {
    this.modalError.set(null);
    this.editingUser.set(row);
    this.resetPasswordValue.set('');
    this.modalMode.set('password');
  }

  submitResetPassword(): void {
    const row = this.editingUser();
    if (!row) {
      return;
    }
    const p = this.resetPasswordValue();
    if (p.length < 6) {
      this.modalError.set('Password must be at least 6 characters.');
      return;
    }
    this.modalError.set(null);
    this.mutatingId.set(row.userId);
    this.http
      .patch<{ status?: string }>(`/gateway/users/${row.userId}/password`, {password: p})
      .subscribe({
        next: () => {
          this.mutatingId.set(null);
          this.closeModal();
          this.load();
        },
        error: err => {
          this.mutatingId.set(null);
          this.modalError.set(errMsg(err));
        },
      });
  }

  toggleLock(row: UserRow): void {
    if (this.mutatingId() !== null) {
      return;
    }
    const s = (row.status || '').toLowerCase();
    const nextStatus = s === 'locked' ? 'active' : 'locked';
    this.mutatingId.set(row.userId);
    this.mutateError.set(null);
    this.http.patch<UserRow>(`/gateway/users/${row.userId}`, {status: nextStatus}).subscribe({
      next: () => {
        this.mutatingId.set(null);
        this.load();
      },
      error: err => {
        this.mutatingId.set(null);
        this.mutateError.set(errMsg(err));
      },
    });
  }

  remove(row: UserRow): void {
    if (!confirm(`Delete users "${row.username}"?`)) {
      return;
    }
    if (this.mutatingId() !== null) {
      return;
    }
    this.mutatingId.set(row.userId);
    this.mutateError.set(null);
    this.http.delete(`/gateway/users/${row.userId}`).subscribe({
      next: () => {
        this.mutatingId.set(null);
        this.load();
      },
      error: err => {
        this.mutatingId.set(null);
        this.mutateError.set(errMsg(err));
      },
    });
  }

  chipClass(mode: StatusFilter): string {
    const base =
      'flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg border pl-3 pr-3 text-sm transition-colors';
    if (this.statusFilter() === mode) {
      return base + ' bg-blue-600/20 border-blue-500/30 text-blue-500 font-bold';
    }
    return base + ' bg-[#0b1121] border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 font-medium';
  }

  badgeClass(status: string | null | undefined): string {
    const s = (status || '').toLowerCase();
    const base =
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border';
    if (s === 'active' || s === 'enabled') {
      return base + ' bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
    if (s === 'locked') {
      return base + ' bg-red-500/10 text-red-500 border-red-500/20';
    }
    if (s === 'pending') {
      return base + ' bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
    return base + ' bg-slate-500/10 text-slate-400 border-slate-600/30';
  }
}

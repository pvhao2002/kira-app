import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Api, apiResource} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {StateBox} from '../../shared/state-box';
import {Paged, errMsg} from './admin.data';

interface UserRow {
  id: number;
  email: string;
  fullName: string;
  role: 'customer' | 'staff' | 'manager' | 'admin';
  status: 'ACTIVE' | 'LOCKED';
  branchIds: number[];
}

const ROLE: Record<string, string | undefined> = {staff: 'Nhân viên', manager: 'Quản lý', admin: 'Quản trị viên', customer: 'Khách hàng'};
const SIZE = 20;

type BackRole = 'staff' | 'manager' | 'admin';
const ROLE_OPTIONS: {key: BackRole; label: string}[] = (['staff', 'manager', 'admin'] as const).map(key => ({key, label: ROLE[key]!}));
const toggleIn = (a: number[], id: number): number[] => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

interface NewUser {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: BackRole;
  branchIds: number[];
}

@Component({
  selector: 'app-users-page',
  imports: [StateBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.page.html',
  styleUrl: './users.page.css'
})
export class UsersPage {
  private readonly api = inject(Api);
  readonly branch = inject(BranchStore);
  private readonly auth = inject(AuthStore);
  readonly roleOptions = ROLE_OPTIONS;
  readonly myId = computed(() => this.auth.user()?.id ?? null);
  readonly draft = signal<NewUser | null>(null);

  readonly qInput = signal('');
  readonly q = signal('');
  readonly page = signal(0);
  readonly editing = signal<{id: number; branchIds: number[]} | null>(null);
  readonly sel = signal<number[]>([]);
  readonly busy = signal(false);
  readonly err = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = apiResource<Paged<UserRow>>(() => ({path: '/admin/users', params: {q: this.q(), page: this.page(), size: SIZE}}));

  onSearch(v: string): void {
    this.qInput.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q.set(v.trim());
      this.page.set(0);
    }, 300);
  }

  readonly error = computed(() => (this.list.error() ? errMsg(this.list.error()) : ''));
  readonly rows = computed(() =>
    this.list.hasValue()
      ? this.list.value().data.map(u => ({
          ...u,
          roleLabel: ROLE[u.role] ?? u.role,
          branchText: u.branchIds.map(id => this.branch.branches[id - 1]?.short ?? `#${id}`).join(', ') || 'Chưa phân công'
        }))
      : []
  );

  edit(u: {id: number; branchIds: number[]}): void {
    this.editing.set(u);
    this.sel.set([...u.branchIds]);
    this.err.set('');
  }

  toggle(id: number): void {
    this.sel.update(a => toggleIn(a, id));
  }

  async save(): Promise<void> {
    const u = this.editing();
    if (!u || this.busy()) return;
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.put(`/admin/users/${u.id}/branches`, {branchIds: this.sel()});
      this.editing.set(null);
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  openCreate(): void {
    this.err.set('');
    this.draft.set({fullName: '', email: '', phone: '', password: '', role: 'staff', branchIds: []});
  }

  closeCreate(): void {
    this.err.set('');
    this.draft.set(null);
  }

  patch<K extends keyof NewUser>(key: K, value: NewUser[K]): void {
    this.draft.update(d => (d ? {...d, [key]: value} : d));
  }

  toggleNew(id: number): void {
    this.draft.update(d => (d ? {...d, branchIds: toggleIn(d.branchIds, id)} : d));
  }

  async create(): Promise<void> {
    const d = this.draft();
    if (!d || this.busy()) return;
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.post('/admin/users', {
        fullName: d.fullName.trim(), email: d.email.trim(), phone: d.phone.trim(), password: d.password,
        role: d.role, branchIds: d.role === 'admin' ? [] : d.branchIds
      });
      this.draft.set(null);
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  async changeRole(u: {id: number; fullName: string; role: string}, role: string): Promise<void> {
    if (this.busy() || role === u.role) return;
    if (!confirm(`Đổi vai trò của ${u.fullName} thành "${ROLE[role] ?? role}"? Người này sẽ bị đăng xuất khỏi mọi phiên.`)) {
      this.list.reload();
      return;
    }
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.put(`/admin/users/${u.id}/role`, {role});
      if (this.editing()?.id === u.id) this.editing.set(null);
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
      this.list.reload();
    }
  }
}

import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Api, apiResource} from '../../core/api';
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
    this.sel.update(a => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]));
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
}

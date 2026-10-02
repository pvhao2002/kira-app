import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Api, apiResource} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {num} from '../../core/format';
import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {Paged, errMsg, fmtDate} from './admin.data';

interface Customer {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  status: 'ACTIVE' | 'LOCKED';
  createdAt: string;
  orderCount: number;
  totalSpent: number;
}

const SIZE = 20;

@Component({
  selector: 'app-customers-page',
  imports: [StateBox, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customers.page.html',
  styleUrl: './customers.page.css'
})
export class CustomersPage {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthStore);

  readonly number = num;
  /** Lock/unlock is admin-only on the backend, so the buttons are hidden for everyone else. */
  readonly isAdmin = computed(() => this.auth.user()?.role === 'admin');

  readonly qInput = signal('');
  readonly q = signal('');
  readonly page = signal(0);
  readonly busyId = signal<number | null>(null);
  readonly err = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = apiResource<Paged<Customer>>(() => ({path: '/admin/customers', params: {q: this.q(), page: this.page(), size: SIZE}}));

  readonly error = computed(() => (this.list.error() ? errMsg(this.list.error()) : ''));
  readonly rows = computed(() =>
    this.list.hasValue() ? this.list.value().data.map(c => ({...c, initial: c.fullName.split(' ').pop()?.[0] ?? '?', joined: fmtDate(c.createdAt)})) : []
  );

  onSearch(v: string): void {
    this.qInput.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q.set(v.trim());
      this.page.set(0);
    }, 300);
  }

  async toggle(c: {id: number; fullName: string; status: Customer['status']}): Promise<void> {
    const lock = c.status === 'ACTIVE';
    if (this.busyId() === c.id || (lock && !confirm(`Khóa tài khoản của ${c.fullName}?`))) return;
    this.busyId.set(c.id);
    this.err.set('');
    try {
      await this.api.post(`/admin/customers/${c.id}/${lock ? 'lock' : 'unlock'}`);
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busyId.set(null);
    }
  }
}

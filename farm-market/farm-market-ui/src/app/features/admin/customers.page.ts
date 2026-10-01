import {ChangeDetectionStrategy, Component, computed, inject, resource, signal} from '@angular/core';
import {Api} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {num, vnd} from '../../core/format';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">Khách hàng</div>
        <h1 class="page-title">Khách hàng</h1>
      </div>
      @if (list.hasValue()) {
        <span class="chip">Tổng: {{ number(list.value().meta.totalElements) }} khách hàng</span>
      }
    </header>

    <div class="card panel">
      <div class="row wrap bar">
        <input class="input search" type="search" placeholder="Tìm tên, số điện thoại, email…" aria-label="Tìm khách hàng" [value]="qInput()" (input)="onSearch($any($event.target).value)">
      </div>
      @if (list.error()) {
        <div class="state-box nb" role="alert"><b>{{ msg(list.error()) }}</b><button type="button" class="btn secondary" (click)="list.reload()">Thử lại</button></div>
      } @else if (!list.hasValue()) {
        <div class="state-box nb" role="status">Đang tải khách hàng…</div>
      } @else if (list.value().data.length) {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Khách hàng</th><th>Điện thoại</th><th>Email</th><th>Số đơn</th><th>Tổng chi tiêu</th><th>Ngày tham gia</th><th>Tài khoản</th>@if (isAdmin()) {<th></th>}</tr></thead>
            <tbody>
              @for (c of list.value().data; track c.id) {
                <tr>
                  <td><div class="row"><span class="av" aria-hidden="true">{{ initial(c.fullName) }}</span>{{ c.fullName }}</div></td>
                  <td>{{ c.phone || '—' }}</td>
                  <td>{{ c.email }}</td>
                  <td>{{ c.orderCount }}</td>
                  <td><b>{{ money(c.totalSpent) }}</b></td>
                  <td>{{ date(c.createdAt) }}</td>
                  <td><span class="pill" [class]="c.status === 'ACTIVE' ? 'ok' : 'bad'">{{ c.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa' }}</span></td>
                  @if (isAdmin()) {
                    <td>
                      <button type="button" class="btn secondary sm" [disabled]="busyId() === c.id" (click)="toggle(c)">{{ c.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa' }}</button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="row foot">
          <span class="muted">{{ list.value().data.length }} / {{ list.value().meta.totalElements }} khách hàng</span>
          <span class="spacer"></span>
          <button type="button" class="pg" aria-label="Trang trước" [disabled]="page() === 0" (click)="page.set(page() - 1)">‹</button>
          <span class="muted">Trang {{ page() + 1 }} / {{ list.value().meta.totalPages || 1 }}</span>
          <button type="button" class="pg" aria-label="Trang sau" [disabled]="page() + 1 >= list.value().meta.totalPages" (click)="page.set(page() + 1)">›</button>
        </div>
      } @else {
        <div class="state-box nb">Không tìm thấy khách hàng phù hợp.</div>
      }
      @if (err()) {<p class="err small pad" role="alert">{{ err() }}</p>}
    </div>
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .small { font-size: 12px; }
    .err { color: var(--danger); }
    .pad { padding: 0 16px 16px; }
    .panel { padding: 0; overflow: hidden; }
    .bar { padding: 16px; border-bottom: 1px solid var(--border); }
    .search { max-width: 340px; flex: 1 1 220px; padding: 10px 14px; }
    .chip { padding: 9px 14px; border-radius: 12px; background: var(--surface-2); font-size: 13px; }
    .av { width: 32px; height: 32px; border-radius: 50%; background: var(--tint); color: var(--primary); font-weight: 700; display: grid; place-items: center; flex: none; }
    .nb { border: 0; border-radius: 0; }
    .foot { padding: 14px 16px; }
    .pg { min-width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
    .pg:disabled { opacity: .4; }
    @media (max-width: 767px) { .search { max-width: none; } }
  `
})
export class CustomersPage {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthStore);

  readonly money = vnd;
  readonly number = num;
  readonly date = fmtDate;
  readonly msg = errMsg;
  /** Lock/unlock is admin-only on the backend, so the buttons are hidden for everyone else. */
  readonly isAdmin = computed(() => this.auth.user()?.role === 'admin');

  readonly qInput = signal('');
  readonly q = signal('');
  readonly page = signal(0);
  readonly busyId = signal<number | null>(null);
  readonly err = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = resource({
    params: () => ({q: this.q(), page: this.page()}),
    loader: ({params}) => this.api.get<Paged<Customer>>('/admin/customers', {...params, size: SIZE})
  });

  onSearch(v: string): void {
    this.qInput.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q.set(v.trim());
      this.page.set(0);
    }, 300);
  }

  initial(name: string): string {
    return name.split(' ').pop()?.[0] ?? '?';
  }

  async toggle(c: Customer): Promise<void> {
    const lock = c.status === 'ACTIVE';
    if (lock && !confirm(`Khóa tài khoản của ${c.fullName}?`)) return;
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

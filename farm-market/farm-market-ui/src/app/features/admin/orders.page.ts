import {ChangeDetectionStrategy, Component, computed, inject, resource, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {Api} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {vnd} from '../../core/format';
import {OrderStatus, PAY_LABEL, Paged, STATUS, STATUS_KEYS, errMsg, fmtDateTime} from './admin.data';

interface OrderRow {
  id: number;
  code: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  paymentMethod: string;
  customerName: string;
  recipient: string;
  createdAt: string;
}
type OrderList = Paged<OrderRow> & {counts: Record<string, number>};

const SIZE = 20;

@Component({
  selector: 'app-admin-orders-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">Đơn hàng</div>
        <h1 class="page-title">Đơn hàng · {{ branch.current().short }}</h1>
      </div>
    </header>

    <div class="row wrap tabs" role="tablist">
      @for (t of tabs(); track t.key) {
        <button type="button" role="tab" class="tab-pill" [class.on]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)">
          {{ t.name }} <span class="n">{{ t.n }}</span>
        </button>
      }
    </div>

    <div class="card panel">
      <div class="row wrap filters">
        <input class="input search" type="search" placeholder="Tìm mã đơn, tên, số điện thoại…" aria-label="Tìm đơn hàng" [value]="qInput()" (input)="onSearch($any($event.target).value)">
        <label class="date">Từ <input class="input" type="date" [value]="from()" (change)="setDate('from', $any($event.target).value)"></label>
        <label class="date">Đến <input class="input" type="date" [value]="to()" (change)="setDate('to', $any($event.target).value)"></label>
      </div>
      @if (list.error()) {
        <div class="state-box nb" role="alert">
          <b>{{ msg(list.error()) }}</b>
          <button type="button" class="btn secondary" (click)="list.reload()">Thử lại</button>
        </div>
      } @else if (!list.hasValue()) {
        <div class="state-box nb" role="status">Đang tải đơn hàng…</div>
      } @else if (list.value().data.length) {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>SP</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead>
            <tbody>
              @for (o of list.value().data; track o.id) {
                <tr class="clickable" (click)="open(o.code)">
                  <td><a class="mono id" [routerLink]="['/admin/orders', o.code]" (click)="$event.stopPropagation()">{{ o.code }}</a></td>
                  <td><div>{{ o.customerName || o.recipient }}</div>@if (o.customerName && o.recipient !== o.customerName) {<div class="muted small">Nhận: {{ o.recipient }}</div>}</td>
                  <td>{{ time(o.createdAt) }}</td>
                  <td>{{ o.itemCount }}</td>
                  <td><b>{{ money(o.total) }}</b></td>
                  <td>{{ pay[o.paymentMethod] ?? o.paymentMethod }}</td>
                  <td><span class="pill" [class]="status[o.status].cls">{{ status[o.status].label }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="state-box nb">Không có đơn hàng nào phù hợp.</div>
      }
      @if (list.hasValue()) {
        <div class="row foot">
          <span class="muted">Hiển thị {{ list.value().data.length }} / {{ list.value().meta.totalElements }} đơn</span>
          <span class="spacer"></span>
          <div class="row">
            <button type="button" class="pg" aria-label="Trang trước" [disabled]="page() === 0" (click)="page.set(page() - 1)">‹</button>
            <span class="muted">Trang {{ page() + 1 }} / {{ list.value().meta.totalPages || 1 }}</span>
            <button type="button" class="pg" aria-label="Trang sau" [disabled]="page() + 1 >= list.value().meta.totalPages" (click)="page.set(page() + 1)">›</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .tabs { margin-bottom: 16px; }
    .panel { padding: 0; overflow: hidden; }
    .filters { padding: 16px; border-bottom: 1px solid var(--border); }
    .search { max-width: 340px; flex: 1 1 220px; padding: 10px 14px; }
    .date { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
    .date .input { padding: 8px 10px; }
    .small { font-size: 12px; }
    .id { color: var(--primary); font-weight: 600; }
    .foot { padding: 14px 16px; }
    .pg { min-width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
    .pg:disabled { opacity: .4; }
    .nb { border: 0; border-radius: 0; }
    @media (max-width: 767px) { .search { max-width: none; } }
  `
})
export class AdminOrdersPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly branch = inject(BranchStore);

  readonly status = STATUS;
  readonly pay = PAY_LABEL;
  readonly money = vnd;
  readonly time = fmtDateTime;
  readonly msg = errMsg;

  readonly tab = signal<OrderStatus | ''>('');
  readonly qInput = signal('');
  readonly q = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly page = signal(0);
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = resource({
    params: () => ({branchId: this.branch.branchId(), status: this.tab(), q: this.q(), from: this.from(), to: this.to(), page: this.page()}),
    loader: ({params}) => this.api.get<OrderList>('/admin/orders', {...params, size: SIZE})
  });

  readonly tabs = computed(() => {
    const counts = this.list.hasValue() ? this.list.value().counts : null;
    const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
    return [
      {key: '' as OrderStatus | '', name: 'Tất cả', n: counts ? total : '–'},
      ...STATUS_KEYS.map(k => ({key: k as OrderStatus | '', name: STATUS[k].label, n: counts ? (counts[k] ?? 0) : '–'}))
    ];
  });

  setTab(t: OrderStatus | ''): void {
    this.tab.set(t);
    this.page.set(0);
  }

  onSearch(v: string): void {
    this.qInput.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q.set(v.trim());
      this.page.set(0);
    }, 300);
  }

  setDate(which: 'from' | 'to', v: string): void {
    (which === 'from' ? this.from : this.to).set(v);
    this.page.set(0);
  }

  open(code: string): void {
    void this.router.navigate(['/admin/orders', code]);
  }
}

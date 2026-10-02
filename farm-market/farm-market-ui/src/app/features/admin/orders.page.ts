import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {apiResource} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
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
  imports: [RouterLink, StateBox, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.page.html',
  styleUrl: './orders.page.css'
})
export class AdminOrdersPage {
  private readonly router = inject(Router);
  readonly branch = inject(BranchStore);

  readonly status = STATUS;

  readonly tab = signal<OrderStatus | ''>('');
  readonly qInput = signal('');
  readonly q = signal('');
  readonly from = signal('');
  readonly to = signal('');
  /** Back to the first page whenever the working branch changes. */
  readonly page = linkedSignal({source: () => this.branch.branchId(), computation: () => 0});
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = apiResource<OrderList>(() => ({
    path: '/admin/orders',
    params: {branchId: this.branch.branchId(), status: this.tab(), q: this.q(), from: this.from(), to: this.to(), page: this.page(), size: SIZE}
  }));

  readonly error = computed(() => (this.list.error() ? errMsg(this.list.error()) : ''));
  readonly rows = computed(() =>
    this.list.hasValue() ? this.list.value().data.map(o => ({...o, time: fmtDateTime(o.createdAt), pay: PAY_LABEL[o.paymentMethod] ?? o.paymentMethod})) : []
  );

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

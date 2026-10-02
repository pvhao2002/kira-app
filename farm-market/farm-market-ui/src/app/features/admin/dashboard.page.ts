import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {apiResource} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {num, vnd} from '../../core/format';
import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {OrderStatus, Paged, STATUS, errMsg, fmtDayMonth} from './admin.data';

interface DayPoint {date: string; revenue: number; orders: number}
interface Dashboard {
  branchId: number;
  days: number;
  kpis: {revenueToday: number; revenueMonth: number; ordersToday: number; ordersMonth: number; newCustomersToday: number; newCustomersMonth: number};
  ordersByStatus: Record<string, number>;
  revenueSeries: DayPoint[];
  topSellers: {productId: number; name: string; quantity: number; revenue: number}[];
  lowStock: {productId: number; sku: string; name: string; branchId: number; available: number; level: string}[];
}
interface OrderRow {id: number; code: string; status: OrderStatus; total: number; customerName: string; recipient: string}

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, StateBox, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.css'
})
export class DashboardPage {
  readonly branch = inject(BranchStore);

  readonly status = STATUS;
  readonly metrics = ['Doanh thu', 'Đơn hàng'];
  readonly metric = signal(0);
  readonly today = new Intl.DateTimeFormat('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'}).format(new Date());

  readonly dash = apiResource<Dashboard>(() => ({path: '/admin/dashboard', params: {branchId: this.branch.branchId(), days: 30}}));
  readonly orders = apiResource<Paged<OrderRow>>(() => ({path: '/admin/orders', params: {branchId: this.branch.branchId(), size: 5}}));

  readonly dashError = computed(() => (this.dash.error() ? errMsg(this.dash.error()) : ''));
  readonly ordersError = computed(() => (this.orders.error() ? errMsg(this.orders.error()) : ''));

  readonly d = computed(() => (this.dash.hasValue() ? this.dash.value() : null));

  readonly kpis = computed(() => {
    const k = this.d()?.kpis;
    if (!k) return [];
    return [
      {label: 'Doanh thu hôm nay', value: vnd(k.revenueToday), sub: `Tháng này: ${vnd(k.revenueMonth)}`},
      {label: 'Doanh thu tháng', value: vnd(k.revenueMonth), sub: 'Đơn chưa hủy trong tháng'},
      {label: 'Đơn hàng hôm nay', value: num(k.ordersToday), sub: `Tháng này: ${num(k.ordersMonth)} đơn`},
      {label: 'Khách mới hôm nay', value: num(k.newCustomersToday), sub: `Tháng này: ${num(k.newCustomersMonth)}`}
    ];
  });

  readonly bars = computed(() => {
    const series = this.d()?.revenueSeries ?? [];
    const val = (p: DayPoint) => (this.metric() === 0 ? p.revenue : p.orders);
    const max = Math.max(1, ...series.map(val));
    return series.map(p => ({
      date: p.date,
      h: Math.max(2, Math.round((val(p) / max) * 96)),
      tip: `${fmtDayMonth(p.date)}: ${this.metric() === 0 ? vnd(p.revenue) : p.orders + ' đơn'}`
    }));
  });

  readonly axis = computed(() => {
    const s = this.d()?.revenueSeries ?? [];
    return s.length ? [fmtDayMonth(s[0].date), fmtDayMonth(s[Math.floor(s.length / 2)].date), fmtDayMonth(s[s.length - 1].date)] : ['', '', ''];
  });

  readonly top = computed(() => {
    const t = this.d()?.topSellers ?? [];
    const max = Math.max(1, ...t.map(x => x.quantity));
    return t.map(x => ({...x, w: Math.round((x.quantity / max) * 100)}));
  });
}

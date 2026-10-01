import {ChangeDetectionStrategy, Component, computed, inject, resource, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Api} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {num, vnd} from '../../core/format';
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
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">{{ today }}</div>
        <h1 class="page-title">Tổng quan</h1>
      </div>
      <div class="row wrap">
        <span class="chip">{{ branch.current().name }}</span>
        <span class="chip">30 ngày qua</span>
        <a class="btn" routerLink="/admin/products">+ Thêm sản phẩm</a>
      </div>
    </header>

    @if (dash.error()) {
      <div class="state-box" role="alert">
        <b>{{ msg(dash.error()) }}</b>
        <button type="button" class="btn secondary" (click)="dash.reload()">Thử lại</button>
      </div>
    } @else if (d(); as d) {
      <section class="kpis">
        @for (k of kpis(); track k.label) {
          <div class="card kpi">
            <div class="muted small">{{ k.label }}</div>
            <div class="serif val">{{ k.value }}</div>
            <div class="delta">{{ k.sub }}</div>
          </div>
        }
      </section>

      <section class="two">
        <div class="card">
          <div class="row between">
            <b>{{ metrics[metric()] }}</b>
            <div class="row wrap" role="tablist">
              @for (m of metrics; track m; let i = $index) {
                <button type="button" role="tab" class="tab-pill" [class.on]="metric() === i" [attr.aria-selected]="metric() === i" (click)="metric.set(i)">{{ m }}</button>
              }
            </div>
          </div>
          <div class="chart" role="img" [attr.aria-label]="'Biểu đồ ' + metrics[metric()] + ' ' + d.days + ' ngày qua'">
            @for (b of bars(); track b.date; let last = $last) {
              <i [class.last]="last" [style.height.%]="b.h" [title]="b.tip"></i>
            }
          </div>
          <div class="axis muted"><span>{{ axis()[0] }}</span><span>{{ axis()[1] }}</span><span>{{ axis()[2] }}</span></div>
        </div>
        <div class="card">
          <b>Bán chạy</b>
          @if (top().length) {
            <div class="stack top">
              @for (t of top(); track t.productId) {
                <div>
                  <div class="row between"><span>{{ t.name }}</span><b>{{ t.quantity }}</b></div>
                  <div class="track"><i [style.width.%]="t.w"></i></div>
                </div>
              }
            </div>
          } @else {
            <div class="state-box">Chưa có dữ liệu bán hàng.</div>
          }
        </div>
      </section>

      <section class="two b">
        <div class="card">
          <div class="row between">
            <b>Đơn hàng mới</b>
            <a class="link" routerLink="/admin/orders">Tất cả đơn →</a>
          </div>
          @if (orders.hasValue() && orders.value().data.length) {
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Giá trị</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  @for (o of orders.value().data; track o.id) {
                    <tr>
                      <td><a class="mono" [routerLink]="['/admin/orders', o.code]">{{ o.code }}</a></td>
                      <td>{{ o.customerName || o.recipient }}</td>
                      <td>{{ money(o.total) }}</td>
                      <td><span class="pill" [class]="status[o.status].cls">{{ status[o.status].label }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else if (orders.error()) {
            <div class="state-box" role="alert">{{ msg(orders.error()) }}</div>
          } @else {
            <div class="state-box">{{ orders.isLoading() ? 'Đang tải…' : 'Chưa có đơn hàng mới.' }}</div>
          }
        </div>
        <div class="card">
          <div class="row"><i class="dot"></i><b>Sản phẩm sắp hết hàng</b></div>
          @if (d.lowStock.length) {
            <ul class="low">
              @for (l of d.lowStock; track l.productId) {
                <li>
                  <div>
                    <div>{{ l.name }}</div>
                    <div class="muted small"><span class="mono">{{ l.sku }}</span> · {{ branch.current().short }}</div>
                  </div>
                  <b [class.bad]="l.available < 10">{{ l.available === 0 ? 'Hết' : 'Còn ' + l.available }}</b>
                </li>
              }
            </ul>
          } @else {
            <div class="state-box">Tồn kho đang ổn định.</div>
          }
          <a class="btn secondary block" routerLink="/admin/inventory">Nhập kho</a>
        </div>
      </section>
    } @else {
      <div class="state-box" role="status">Đang tải dữ liệu…</div>
    }
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .chip { padding: 8px 14px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-size: 13px; }
    .small { font-size: 12px; }
    .between { justify-content: space-between; flex-wrap: wrap; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
    .kpi { padding: 20px; display: flex; flex-direction: column; gap: 6px; }
    .val { font-size: 32px; line-height: 1.1; }
    .delta { font-size: 12px; font-weight: 600; color: var(--primary); }
    .two { display: grid; grid-template-columns: 1.7fr 1fr; gap: 20px; margin-bottom: 20px; }
    .two.b { grid-template-columns: 1.7fr 1fr; }
    .chart { display: flex; align-items: flex-end; gap: 6px; height: 220px; margin-top: 18px; border-bottom: 1px solid var(--line); }
    .chart i { flex: 1; min-width: 2px; border-radius: 4px 4px 0 0; background: color-mix(in oklch, var(--primary) 32%, #fffdf8); }
    .chart i.last { background: var(--primary); }
    .axis { display: flex; justify-content: space-between; font-size: 12px; margin-top: 8px; }
    .top { gap: 14px; margin-top: 16px; }
    .track { height: 8px; border-radius: 999px; background: var(--surface-2); margin-top: 6px; overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--primary); border-radius: 999px; }
    .link { color: var(--primary); font-weight: 600; font-size: 13px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--danger); }
    .low { list-style: none; margin: 8px 0 16px; padding: 0; }
    .low li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--border); }
    .low b { color: var(--brown); }
    .low b.bad { color: var(--danger); }
    @media (max-width: 767px) {
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .two, .two.b { grid-template-columns: 1fr; }
      .val { font-size: 26px; }
    }
  `
})
export class DashboardPage {
  private readonly api = inject(Api);
  readonly branch = inject(BranchStore);

  readonly status = STATUS;
  readonly metrics = ['Doanh thu', 'Đơn hàng'];
  readonly metric = signal(0);
  readonly money = vnd;
  readonly msg = errMsg;
  readonly today = new Intl.DateTimeFormat('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'}).format(new Date());

  readonly dash = resource({
    params: () => ({branchId: this.branch.branchId()}),
    loader: ({params}) => this.api.get<Dashboard>('/admin/dashboard', {branchId: params.branchId, days: 30})
  });
  readonly orders = resource({
    params: () => ({branchId: this.branch.branchId()}),
    loader: ({params}) => this.api.get<Paged<OrderRow>>('/admin/orders', {branchId: params.branchId, size: 5})
  });

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

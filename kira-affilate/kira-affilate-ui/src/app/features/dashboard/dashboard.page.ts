import {ChangeDetectionStrategy, Component, computed, inject, Resource, signal} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';
import {Granularity, TopBy, TopRow} from '../../core/api/models';
import {OrdersApi} from '../../core/api/orders-api.service';
import {ReportsApi} from '../../core/api/reports-api.service';
import {ShopeeApi} from '../../core/api/shopee-api.service';
import {formatDateTime, formatNumber, formatVnd} from '../../core/format/formatters';
import {DateRangePicker} from '../../shared/date-range';
import {presetRange} from '../../shared/date-range.util';
import {valueOr} from '../../shared/resource.util';
import {StatCard} from '../../shared/stat-card';
import {StateBox} from '../../shared/state-box';
import {StatusBadge} from '../../shared/status-badge';
import {SyncChip} from '../../shared/sync-chip';
import {TrendChart} from '../../shared/trend-chart';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DateRangePicker, StatCard, StateBox, StatusBadge, SyncChip, TrendChart],
  templateUrl: './dashboard.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPage {
  private readonly reports = inject(ReportsApi);
  private readonly orders = inject(OrdersApi);
  private readonly shopee = inject(ShopeeApi);
  protected readonly formatVnd = formatVnd;
  protected readonly formatNumber = formatNumber;
  protected readonly formatDateTime = formatDateTime;

  protected readonly range = signal(presetRange('30d'));
  protected readonly granularity = signal<Granularity>('day');
  protected readonly granularities: {id: Granularity; label: string}[] = [
    {id: 'day', label: 'Ngày'}, {id: 'week', label: 'Tuần'}, {id: 'month', label: 'Tháng'}
  ];

  protected readonly credentials = rxResource({stream: () => this.shopee.credentials()});
  protected readonly connected = computed(() => valueOr(this.credentials, null)?.configured === true);
  /** Report requests wait until Shopee is known to be connected, so a new account never sees a wall of zeros. */
  private readonly query = computed(() => this.connected() ? this.range() : undefined);

  protected readonly summary = rxResource({params: this.query, stream: ({params}) => this.reports.summary(params.from, params.to)});
  protected readonly series = rxResource({
    params: () => this.connected() ? {...this.range(), granularity: this.granularity()} : undefined,
    stream: ({params}) => this.reports.timeseries(params.from, params.to, params.granularity)
  });
  protected readonly points = computed(() => valueOr(this.series, []));
  protected readonly recent = rxResource({
    params: () => this.connected() ? true : undefined,
    stream: () => this.orders.list({page: 0, size: 8, sort: 'purchaseTime,desc'})
  });
  protected readonly recentRows = computed(() => valueOr(this.recent, null)?.data ?? []);

  protected readonly tops = [
    {title: 'Sản phẩm hàng đầu', column: 'Sản phẩm', res: this.top('product')},
    {title: 'Sub ID hàng đầu', column: 'Sub ID', res: this.top('subId')},
    {title: 'Chiến dịch hàng đầu', column: 'Chiến dịch', res: this.top('campaign')}
  ];

  protected readonly cards = computed(() => {
    const s = valueOr(this.summary, null);
    if (!s) return [];
    return [
      {id: 'orders', label: 'Đơn hàng', value: formatNumber(s.orders), hint: `${formatNumber(s.items)} sản phẩm`},
      {id: 'gmv', label: 'Doanh số (GMV)', value: formatVnd(s.gmv), hint: ''},
      {id: 'estimated', label: 'Hoa hồng ước tính', value: formatVnd(s.commission.estimated), hint: 'Đơn chưa hoàn thành'},
      {id: 'confirmed', label: 'Hoa hồng đã xác nhận', value: formatVnd(s.commission.confirmed), hint: 'Đơn đã hoàn thành'},
      {id: 'rejected', label: 'Hoa hồng bị hủy', value: formatVnd(s.commission.rejected), hint: 'Đơn hủy hoặc gian lận'},
      {id: 'validated', label: 'Đã đối soát thanh toán', value: formatVnd(s.commission.validated), hint: 'Theo báo cáo đối soát Shopee'},
      {id: 'links', label: 'Liên kết đã tạo', value: formatNumber(s.links), hint: ''}
    ];
  });

  protected rows(res: Resource<TopRow[] | undefined>): TopRow[] {
    return valueOr(res, []);
  }

  protected reload(): void {
    for (const r of [this.summary, this.series, this.recent, ...this.tops.map(t => t.res)]) r.reload();
  }

  private top(by: TopBy) {
    return rxResource({params: this.query, stream: ({params}) => this.reports.top(params.from, params.to, by, 5)});
  }
}

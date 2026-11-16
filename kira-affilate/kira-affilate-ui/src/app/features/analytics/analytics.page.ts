import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {Granularity, TopBy} from '../../core/api/models';
import {ReportsApi} from '../../core/api/reports-api.service';
import {downloadCsv} from '../../core/format/csv';
import {formatNumber, formatVnd} from '../../core/format/formatters';
import {Sort, SortHeader, sortRows} from '../../shared/data-table';
import {DateRangePicker} from '../../shared/date-range';
import {presetRange} from '../../shared/date-range.util';
import {valueOr} from '../../shared/resource.util';
import {StateBox} from '../../shared/state-box';
import {statusLabel} from '../../shared/status-badge';
import {TrendChart} from '../../shared/trend-chart';

const DIMENSIONS: {id: TopBy; label: string}[] = [
  {id: 'product', label: 'Sản phẩm'},
  {id: 'shop', label: 'Shop'},
  {id: 'subId', label: 'Sub ID'},
  {id: 'campaign', label: 'Chiến dịch'},
  {id: 'status', label: 'Trạng thái đơn'},
  {id: 'category', label: 'Ngành hàng'},
  {id: 'device', label: 'Thiết bị'},
  {id: 'buyerType', label: 'Loại người mua'}
];

@Component({
  selector: 'app-analytics-page',
  imports: [FormsModule, DateRangePicker, SortHeader, StateBox, TrendChart],
  templateUrl: './analytics.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsPage {
  private readonly reports = inject(ReportsApi);
  protected readonly formatVnd = formatVnd;
  protected readonly formatNumber = formatNumber;
  protected readonly dimensions = DIMENSIONS;
  protected readonly granularities: {id: Granularity; label: string}[] = [
    {id: 'day', label: 'Ngày'}, {id: 'week', label: 'Tuần'}, {id: 'month', label: 'Tháng'}
  ];

  protected readonly range = signal(presetRange('30d'));
  protected readonly granularity = signal<Granularity>('day');
  protected readonly by = signal<TopBy>('product');
  protected readonly sort = signal<Sort>({field: 'commission', dir: 'desc'});

  protected readonly series = rxResource({
    params: () => ({...this.range(), granularity: this.granularity()}),
    stream: ({params}) => this.reports.timeseries(params.from, params.to, params.granularity)
  });
  protected readonly points = computed(() => valueOr(this.series, []));

  protected readonly top = rxResource({
    params: () => ({...this.range(), by: this.by()}),
    stream: ({params}) => this.reports.top(params.from, params.to, params.by, 100)
  });
  protected readonly dimensionLabel = computed(() => DIMENSIONS.find(d => d.id === this.by())?.label ?? '');
  protected readonly rows = computed(() => {
    // Order statuses arrive as Shopee enum values; show them in Vietnamese like everywhere else.
    const rows = valueOr(this.top, []).map(r => this.by() === 'status' ? {...r, label: statusLabel(r.label)} : r);
    return sortRows(rows, this.sort());
  });

  protected exportCsv(): void {
    const {from, to} = this.range();
    downloadCsv(`thong-ke_${this.by()}_${from}_${to}.csv`,
      [this.dimensionLabel(), 'Đơn hàng', 'Sản phẩm bán ra', 'Doanh số (GMV)', 'Hoa hồng'],
      this.rows().map(r => [r.label, r.orders, r.items, r.gmv, r.commission]));
  }
}

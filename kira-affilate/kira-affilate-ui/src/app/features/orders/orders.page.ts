import {ChangeDetectionStrategy, Component, computed, ElementRef, inject, linkedSignal, signal, viewChild} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {apiErrorMessage} from '../../core/api/api-error';
import {Bucket, OrderStatus} from '../../core/api/models';
import {OrdersApi} from '../../core/api/orders-api.service';
import {saveBlob} from '../../core/format/csv';
import {formatDateTime, formatNumber, formatVnd} from '../../core/format/formatters';
import {ToastService} from '../../core/services/toast.service';
import {Pager, Sort, SortHeader, sortParam} from '../../shared/data-table';
import {DateRangePicker} from '../../shared/date-range';
import {presetRange} from '../../shared/date-range.util';
import {valueOr} from '../../shared/resource.util';
import {StateBox} from '../../shared/state-box';
import {StatusBadge, statusLabel} from '../../shared/status-badge';
import {SyncChip} from '../../shared/sync-chip';

@Component({
  selector: 'app-orders-page',
  imports: [FormsModule, Pager, SortHeader, DateRangePicker, StateBox, StatusBadge, SyncChip],
  templateUrl: './orders.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersPage {
  private readonly api = inject(OrdersApi);
  private readonly toast = inject(ToastService);
  protected readonly statusLabel = statusLabel;
  protected readonly formatVnd = formatVnd;
  protected readonly formatNumber = formatNumber;
  protected readonly formatDateTime = formatDateTime;

  protected readonly buckets: {id: Bucket; meaning: string}[] = [
    {id: 'ESTIMATED', meaning: 'Đơn đang ở trạng thái UNPAID hoặc PENDING; hoa hồng còn có thể thay đổi.'},
    {id: 'CONFIRMED', meaning: 'Đơn đã COMPLETED trên Shopee.'},
    {id: 'REJECTED', meaning: 'Đơn CANCELLED hoặc bị Shopee đánh dấu gian lận; không được tính hoa hồng.'},
    {id: 'VALIDATED', meaning: 'Đơn có trong báo cáo đối soát của Shopee mà bạn đã nhập.'}
  ];
  protected readonly orderStatuses: OrderStatus[] = ['UNPAID', 'PENDING', 'COMPLETED', 'CANCELLED'];

  // ----- order list -----
  protected readonly searchDraft = signal('');
  protected readonly search = signal('');
  protected readonly orderStatus = signal<OrderStatus | ''>('');
  protected readonly bucket = signal<Bucket | ''>('');
  protected readonly range = signal(presetRange('30d'));
  protected readonly sort = signal<Sort>({field: 'purchaseTime', dir: 'desc'});
  private readonly filters = computed(() => ({search: this.search(), orderStatus: this.orderStatus(), bucket: this.bucket(), ...this.range()}));
  /** Any filter change returns to the first page. */
  protected readonly page = linkedSignal({source: this.filters, computation: () => 0});
  protected readonly orders = rxResource({
    params: () => ({...this.filters(), page: this.page(), size: 20, sort: sortParam(this.sort())}),
    stream: ({params}) => this.api.list(params)
  });
  protected readonly rows = computed(() => valueOr(this.orders, null)?.data ?? []);
  protected readonly meta = computed(() => valueOr(this.orders, null)?.meta ?? null);
  protected readonly exporting = signal(false);

  // ----- detail drawer -----
  private readonly drawer = viewChild.required<ElementRef<HTMLDialogElement>>('drawer');
  protected readonly selectedId = signal<number | undefined>(undefined);
  protected readonly detail = rxResource({params: this.selectedId, stream: ({params}) => this.api.detail(params)});
  protected readonly order = computed(() => valueOr(this.detail, null));

  // ----- sync history & validations -----
  protected readonly runsPage = signal(0);
  protected readonly runs = rxResource({params: this.runsPage, stream: ({params}) => this.api.syncRuns(params, 5)});
  protected readonly runRows = computed(() => valueOr(this.runs, null)?.data ?? []);
  protected readonly runMeta = computed(() => valueOr(this.runs, null)?.meta ?? null);
  protected readonly validationsRes = rxResource({stream: () => this.api.validations()});
  protected readonly validations = computed(() => valueOr(this.validationsRes, []));
  protected readonly validationId = signal('');
  protected readonly validationError = signal('');
  protected readonly importing = signal(false);

  protected applySearch(): void {
    this.search.set(this.searchDraft().trim());
  }

  protected open(id: number): void {
    this.selectedId.set(id);
    this.drawer().nativeElement.showModal();
  }

  protected close(): void {
    this.drawer().nativeElement.close();
  }

  /** A click on the dialog element itself is a click on the backdrop. */
  protected backdropClose(event: MouseEvent): void {
    if (event.target === this.drawer().nativeElement) this.close();
  }

  protected exportCsv(): void {
    this.exporting.set(true);
    this.api.export({...this.filters(), sort: sortParam(this.sort())}).subscribe({
      next: blob => {
        this.exporting.set(false);
        saveBlob(blob, `don-hang_${this.range().from}_${this.range().to}.csv`);
      },
      error: e => {
        this.exporting.set(false);
        this.toast.show(apiErrorMessage(e, 'Không xuất được CSV. Vui lòng thử lại.'), 'error');
      }
    });
  }

  protected afterSync(): void {
    this.orders.reload();
    this.runs.reload();
    this.validationsRes.reload();
  }

  protected importValidation(): void {
    const id = this.validationId().trim();
    // Only presence is checked here; the server owns the format of Shopee's validationId.
    this.validationError.set(id ? '' : 'Vui lòng nhập mã đối soát (validationId) do Shopee cung cấp.');
    if (this.validationError() || this.importing()) return;

    this.importing.set(true);
    this.api.importValidation(id).subscribe({
      next: () => {
        this.importing.set(false);
        this.validationId.set('');
        this.toast.show('Đã bắt đầu nhập báo cáo đối soát. Kết quả sẽ hiện trong lịch sử đồng bộ.', 'success');
        this.runs.reload();
        this.validationsRes.reload();
      },
      error: e => {
        this.importing.set(false);
        this.validationError.set(apiErrorMessage(e));
      }
    });
  }
}

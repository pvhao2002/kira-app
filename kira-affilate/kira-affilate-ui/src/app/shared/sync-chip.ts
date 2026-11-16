import {ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, output, signal} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {apiErrorMessage} from '../core/api/api-error';
import {OrdersApi} from '../core/api/orders-api.service';
import {formatDateTime} from '../core/format/formatters';
import {ToastService} from '../core/services/toast.service';
import {StatusBadge} from './status-badge';

/** Sync status from /sync/status with a manual trigger. Polls while a run is in flight and emits `synced` when it ends. */
@Component({
  selector: 'app-sync-chip',
  imports: [StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="sync-chip">
      @if (status.error()) {
        <span class="text-[13px] text-danger" role="alert">Không tải được trạng thái đồng bộ.</span>
        <button type="button" class="btn btn-sm" (click)="status.reload()">Thử lại</button>
      } @else if (!status.hasValue()) {
        <span class="skeleton h-5 w-44" aria-busy="true"><span class="sr-only">Đang tải…</span></span>
      } @else {
        @if (running()) {
          <app-status-badge status="RUNNING"/>
        } @else if (lastRun(); as run) {
          <app-status-badge [status]="run.status"/>
        }
        <span class="muted">
          @if (lastSuccessAt(); as at) {
            Đồng bộ thành công gần nhất: {{ formatDateTime(at) }}
          } @else {
            Chưa đồng bộ lần nào
          }
        </span>
        @if (!running() && lastRun()?.errorMessage; as message) {
          <span class="text-[13px] text-danger">{{ message }}</span>
        }
        <button type="button" class="btn btn-sm" [disabled]="running() || starting()" (click)="sync()" data-testid="sync-now">
          {{ running() ? 'Đang đồng bộ…' : 'Đồng bộ ngay' }}
        </button>
      }
    </div>
  `
})
export class SyncChip {
  readonly synced = output<void>();
  private readonly api = inject(OrdersApi);
  private readonly toast = inject(ToastService);
  protected readonly formatDateTime = formatDateTime;
  protected readonly status = rxResource({stream: () => this.api.syncStatus()});
  protected readonly starting = signal(false);
  protected readonly running = computed(() => this.status.hasValue() && this.status.value().running);
  protected readonly lastRun = computed(() => this.status.hasValue() ? this.status.value().lastRun : null);
  protected readonly lastSuccessAt = computed(() => this.status.hasValue() ? this.status.value().lastSuccessAt : null);

  constructor() {
    let timer = 0, wasRunning = false;
    effect(() => {
      const running = this.running();
      window.clearTimeout(timer);
      if (running) timer = window.setTimeout(() => this.status.reload(), 4000);
      else if (wasRunning) this.synced.emit();
      wasRunning = running;
    });
    inject(DestroyRef).onDestroy(() => window.clearTimeout(timer));
  }

  protected sync(): void {
    this.starting.set(true);
    this.api.sync().subscribe({
      next: () => {
        this.starting.set(false);
        this.toast.show('Đã bắt đầu đồng bộ dữ liệu từ Shopee.', 'success');
        this.status.reload();
      },
      error: e => {
        this.starting.set(false);
        this.toast.show(apiErrorMessage(e), 'error');
        this.status.reload();
      }
    });
  }
}

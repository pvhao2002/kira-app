import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

/** Vietnamese label + tone for every status enum in docs/api.md. Unknown values are shown as-is in neutral. */
const STATUSES: Record<string, [string, Tone]> = {
  // commission buckets
  ESTIMATED: ['Ước tính', 'info'],
  CONFIRMED: ['Đã xác nhận', 'ok'],
  REJECTED: ['Bị hủy', 'danger'],
  VALIDATED: ['Đã đối soát thanh toán', 'ok'],
  // Shopee order status
  UNPAID: ['Chưa thanh toán', 'neutral'],
  PENDING: ['Đang xử lý', 'info'],
  COMPLETED: ['Hoàn thành', 'ok'],
  CANCELLED: ['Đã hủy', 'danger'],
  // link / sync / credential status
  OK: ['Thành công', 'ok'],
  CONNECTED: ['Đã kết nối', 'ok'],
  FAILED: ['Thất bại', 'danger'],
  RUNNING: ['Đang chạy', 'info'],
  SUCCESS: ['Thành công', 'ok'],
  RATE_LIMITED: ['Bị giới hạn tần suất', 'warn'],
  INVALID_CREDENTIAL: ['Sai thông tin', 'danger'],
  NO_API_ACCESS: ['Chưa có quyền API', 'warn'],
  ERROR: ['Lỗi', 'danger']
};

const TONES: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-canvas text-muted'
};

export function statusLabel(status: string | null | undefined): string {
  return status ? STATUSES[status]?.[0] ?? status : '—';
}

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" [class]="tone()">{{ label() }}</span>`
})
export class StatusBadge {
  readonly status = input.required<string | null>();
  protected readonly label = computed(() => statusLabel(this.status()));
  protected readonly tone = computed(() => TONES[STATUSES[this.status() ?? '']?.[1] ?? 'neutral']);
}

import {DecimalPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {catchError, of} from 'rxjs';
import {AuthService} from '../../config/AuthService';
import {
  DashboardActivityItem,
  DashboardApiService,
  DashboardProfitPoint,
  DashboardResponse
} from '../../services/dashboard-api.service';
import {formatVnd} from '../../utils/format-vnd';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    DecimalPipe
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  readonly authService = inject(AuthService);
  private readonly api = inject(DashboardApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<DashboardResponse | null>(null);

  readonly maxChartAmount = computed(() => {
    const chart = this.data()?.profitChart ?? [];
    if (chart.length === 0) {
      return 1;
    }
    return Math.max(...chart.map(p => Math.abs(p.amount)), 1);
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get().pipe(
      catchError(err => {
        const msg = err?.error?.message ?? err?.message ?? 'Không tải được dữ liệu tổng quan.';
        this.error.set(typeof msg === 'string' ? msg : 'Không tải được dữ liệu tổng quan.');
        return of<DashboardResponse | null>(null);
      })
    ).subscribe(res => {
      this.data.set(res);
      this.loading.set(false);
    });
  }

  formatVnd(n: number): string {
    return formatVnd(n);
  }

  chartBarHeight(point: DashboardProfitPoint): number {
    const max = this.maxChartAmount();
    const pct = (Math.abs(point.amount) / max) * 100;
    return Math.max(pct, 4);
  }

  formatRelativeTime(iso: string | null): string {
    if (!iso) {
      return '';
    }
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) {
      return '';
    }
    const diffMs = Date.now() - at.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) {
      return 'Vừa xong';
    }
    if (mins < 60) {
      return `${mins} phút trước`;
    }
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
      return `${hours}h trước`;
    }
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  }

  activityIcon(item: DashboardActivityItem): string {
    if (item.type === 'card_payment') {
      return 'credit_card';
    }
    if (item.type === 'prediction') {
      return 'sports_soccer';
    }
    return item.positive ? 'payments' : 'south_west';
  }

  activityAmountLabel(item: DashboardActivityItem): string {
    if (item.type === 'prediction') {
      return item.positive ? 'Thắng' : 'Thua';
    }
    const prefix = item.positive ? '+' : '-';
    return prefix + this.formatVnd(Math.abs(item.amount));
  }

  activityAmountClass(item: DashboardActivityItem): string {
    if (item.type === 'prediction') {
      return item.positive ? 'text-green-400' : 'text-red-500';
    }
    if (item.type === 'card_payment') {
      return 'text-white';
    }
    return item.positive ? 'text-green-400' : 'text-red-500';
  }

  activityAllLink(): string {
    return this.authService.isAdmin() ? '/events-history' : '/cards';
  }
}

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
        const msg = err?.error?.message ?? err?.message ?? 'Unable to load dashboard data.';
        this.error.set(typeof msg === 'string' ? msg : 'Unable to load dashboard data.');
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
      return 'Just now';
    }
    if (mins < 60) {
      return `${mins} minutes ago`;
    }
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
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
      return item.positive ? 'Win' : 'Loss';
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
    return this.authService.isAdmin() ? '/events-history' : '/bank-card';
  }
}

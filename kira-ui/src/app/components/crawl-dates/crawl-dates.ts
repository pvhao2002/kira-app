import {Component, inject, signal} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {DatePipe, DecimalPipe} from '@angular/common';

import {ToastService} from '../../config/ToastService';

export interface CrawlDateRow {
  date: string;
  status: string;
  message: string | null;
  totalEvents: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CrawlDatePage {
  content: CrawlDateRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type CrawlDateFilterMode = 'basic' | 'advance';
export type CrawlDateSortColumn = 'date' | 'totalEvents';
export type CrawlDateStatusFilter = 'all' | 'pending' | 'picked' | 'in_progress' | 'done' | 'failed';
export type CrawlDateTotalEventFilter = 'all' | '0';

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  picked: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  in_progress: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
  done: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border border-red-500/30'
};

@Component({
  selector: 'app-crawl-dates',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './crawl-dates.html',
  styleUrl: './crawl-dates.css',
  standalone: true
})
export class CrawlDates {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<CrawlDatePage | null>(null);
  /** ISO date (yyyy-MM-dd) đang gửi requeue, hoặc null. */
  readonly requeueingDate = signal<string | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  /** Khớp mặc định API cũ: date giảm dần */
  readonly sortColumn = signal<CrawlDateSortColumn>('date');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly filterMode = signal<CrawlDateFilterMode>('basic');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly statusFilter = signal<CrawlDateStatusFilter>('all');
  readonly totalEventFilter = signal<CrawlDateTotalEventFilter>('all');

  constructor() {
    this.load();
  }

  /** yyyy-MM-dd, yyyyMMdd, hoặc ISO datetime -> dd-MM-yyyy; fallback nếu không khớp. */
  formatDisplayDate(iso: string): string {
    const raw = (iso ?? '').trim();
    if (!raw) {
      return raw;
    }

    // Case 1: compact form yyyyMMdd (e.g. 20260502)
    const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
    if (compact) {
      return `${compact[3]}-${compact[2]}-${compact[1]}`;
    }

    // Case 2: yyyy-MM-dd or ISO datetime starting with yyyy-MM-dd
    const source = raw.length >= 10 ? raw.slice(0, 10) : raw;
    const dashed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
    if (dashed) {
      return `${dashed[3]}-${dashed[2]}-${dashed[1]}`;
    }

    return raw;
  }

  statusBadgeClass(status: string): string {
    const key = (status ?? '').trim().toLowerCase();
    return STATUS_BADGE_CLASS[key] ?? 'bg-slate-800 text-slate-300 border border-white/10';
  }

  private sortByQueryParam(): string {
    return this.sortColumn() === 'date' ? 'date' : 'total_events';
  }

  sortHeaderIcon(column: CrawlDateSortColumn): string {
    if (this.sortColumn() !== column) {
      return 'unfold_more';
    }
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  sortHeaderActive(column: CrawlDateSortColumn): boolean {
    return this.sortColumn() === column;
  }

  toggleSort(column: CrawlDateSortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(column);
      this.sortDir.set('desc');
    }
    this.pageIndex.set(0);
    this.load();
  }

  setFilterMode(mode: CrawlDateFilterMode): void {
    if (this.filterMode() === mode) {
      return;
    }
    this.filterMode.set(mode);
    this.pageIndex.set(0);
    this.load();
  }

  applyAdvancedFilters(): void {
    this.pageIndex.set(0);
    this.load();
  }

  resetAdvancedFilters(): void {
    this.fromDate.set('');
    this.toDate.set('');
    this.statusFilter.set('all');
    this.totalEventFilter.set('all');
    this.pageIndex.set(0);
    this.load();
  }

  requeue(isoDate: string): void {
    if (this.requeueingDate() !== null) {
      return;
    }
    const d = (isoDate ?? '').trim();
    if (!d) {
      return;
    }
    this.requeueingDate.set(d);
    const path = `/gateway/crawl-dates/${encodeURIComponent(d)}/requeue`;
    this.http.post<{ status?: string; date?: string; message?: string }>(path, {}).subscribe({
      next: () => {
        this.requeueingDate.set(null);
        this.toast.success('Đã đưa ngày vào hàng đợi crawl.');
        this.load();
      },
      error: err => {
        this.requeueingDate.set(null);
        const raw = err?.error?.message ?? err?.message ?? 'Không gửi được yêu cầu crawl lại.';
        const msg = typeof raw === 'string' ? raw : 'Không gửi được yêu cầu crawl lại.';
        this.toast.error(msg);
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', String(this.pageIndex()))
      .set('size', String(this.pageSize()))
      .set('sortBy', this.sortByQueryParam())
      .set('sortDir', this.sortDir());

    if (this.filterMode() === 'advance') {
      const dateFrom = this.fromDate().trim();
      const dateTo = this.toDate().trim();
      if (dateFrom) {
        params = params.set('dateFrom', dateFrom);
      }
      if (dateTo) {
        params = params.set('dateTo', dateTo);
      }
      if (this.statusFilter() !== 'all') {
        params = params.set('status', this.statusFilter());
      }
      if (this.totalEventFilter() !== 'all') {
        params = params.set('totalEvent', this.totalEventFilter());
      }
    }

    this.http.get<CrawlDatePage>('/data/crawl-dates', {params}).subscribe({
      next: body => {
        this.data.set(body);
        this.loading.set(false);
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? 'Không tải được dữ liệu.';
        this.error.set(typeof msg === 'string' ? msg : 'Không tải được dữ liệu.');
        this.loading.set(false);
      }
    });
  }

  prev(): void {
    if (this.pageIndex() <= 0) {
      return;
    }
    this.pageIndex.update(p => p - 1);
    this.load();
  }

  next(): void {
    const d = this.data();
    if (!d || this.pageIndex() >= d.totalPages - 1) {
      return;
    }
    this.pageIndex.update(p => p + 1);
    this.load();
  }
}

import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {DecimalPipe} from '@angular/common';

export interface EventClaimRow {
  claimId: number;
  eventId: number;
  claimedBy: string | null;
  claimedAt: string | null;
  status: string | null;
  eventName: string | null;
  eventDate: string | null;
  eventStatus: string | null;
  link: string | null;
}

export interface EventClaimPage {
  content: EventClaimRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type EventClaimSortColumn = 'claimedAt' | 'eventDate';
export type EventClaimStatusFilter = 'all' | 'processing' | 'completed' | 'failed';

@Component({
  selector: 'app-event-process-mq',
  imports: [DecimalPipe],
  templateUrl: './event-process-mq.html',
  styleUrl: './event-process-mq.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventProcessMq {
  private readonly http = inject(HttpClient);
  readonly clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<EventClaimPage | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly sortColumn = signal<EventClaimSortColumn>('claimedAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly claimStatus = signal<EventClaimStatusFilter>('all');

  constructor() {
    this.load();
  }

  sortHeaderIcon(column: EventClaimSortColumn): string {
    if (this.sortColumn() !== column) {
      return 'unfold_more';
    }
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  sortHeaderActive(column: EventClaimSortColumn): boolean {
    return this.sortColumn() === column;
  }

  toggleSort(column: EventClaimSortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(column);
      this.sortDir.set('desc');
    }
    this.pageIndex.set(0);
    this.load();
  }

  onStatusChange(value: string): void {
    const next = (value ?? 'all') as EventClaimStatusFilter;
    this.claimStatus.set(next);
    this.pageIndex.set(0);
    this.load();
  }

  statusLabel(value: string | null): string {
    const key = (value ?? '').trim().toLowerCase();
    if (key === 'processing') {
      return 'Processing';
    }
    if (key === 'completed') {
      return 'Completed';
    }
    if (key === 'failed') {
      return 'Failed';
    }
    return value ?? '—';
  }

  rowTrack(row: EventClaimRow): number {
    return row.claimId;
  }

  formatClientDate(raw: string | null): string {
    const date = this.parseServerDate(raw);
    if (!date) {
      return '—';
    }
    const parts = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
      timeZone: this.clientTimeZone
    }).formatToParts(date);

    const part = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find(p => p.type === type)?.value ?? '00';

    return `${part('day')}-${part('month')}-${part('year')} ${part('hour')}:${part('minute')}:${part('second')}`;
  }

  private sortByApi(): string {
    return this.sortColumn() === 'claimedAt' ? 'claimed_at' : 'event_date';
  }

  private parseServerDate(raw: string | null): Date | null {
    const value = (raw ?? '').trim();
    if (!value) {
      return null;
    }
    const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
    const normalized = hasTimezone ? value : `${value}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', String(this.pageIndex()))
      .set('size', String(this.pageSize()))
      .set('sortBy', this.sortByApi())
      .set('sortDir', this.sortDir());

    if (this.claimStatus() !== 'all') {
      params = params.set('status', this.claimStatus());
    }

    this.http.get<EventClaimPage>('/data/event-claims', {params}).subscribe({
      next: body => {
        this.data.set(body);
        this.loading.set(false);
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? 'Unable to load data.';
        this.error.set(typeof msg === 'string' ? msg : 'Unable to load data.');
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

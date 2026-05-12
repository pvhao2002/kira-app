import {Component, inject, signal} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {DecimalPipe} from '@angular/common';

export interface EventCrawlFailedRow {
  eventId: number;
  type: string | null;
  message: string | null;
  screenshot: string | null;
  createdAt: string | null;
  eventName: string | null;
  eventDate: string | null;
  status: string | null;
  link: string | null;
}

export interface EventCrawlFailedPage {
  content: EventCrawlFailedRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type EventCrawlFailedSortColumn = 'createdAt' | 'eventDate';

@Component({
  selector: 'app-event-crawl-failed',
  imports: [DecimalPipe],
  templateUrl: './event-crawl-failed.html',
  styleUrl: './event-crawl-failed.css',
  standalone: true
})
export class EventCrawlFailed {
  private readonly http = inject(HttpClient);
  readonly clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<EventCrawlFailedPage | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly sortColumn = signal<EventCrawlFailedSortColumn>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly previewImageSrc = signal<string | null>(null);
  readonly previewText = signal<string | null>(null);

  constructor() {
    this.load();
  }

  sortHeaderIcon(column: EventCrawlFailedSortColumn): string {
    if (this.sortColumn() !== column) {
      return 'unfold_more';
    }
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  sortHeaderActive(column: EventCrawlFailedSortColumn): boolean {
    return this.sortColumn() === column;
  }

  toggleSort(column: EventCrawlFailedSortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(column);
      this.sortDir.set('desc');
    }
    this.pageIndex.set(0);
    this.load();
  }

  rowTrack(row: EventCrawlFailedRow): string {
    return `${row.eventId}-${row.type ?? 'unknown'}`;
  }

  openScreenshotPreview(raw: string | null): void {
    const src = this.resolveScreenshotSrc(raw);
    if (!src) {
      return;
    }
    this.previewText.set(null);
    this.previewImageSrc.set(src);
  }

  openMessagePreview(message: string | null): void {
    const text = (message ?? '').trim();
    if (!text) {
      return;
    }
    this.previewImageSrc.set(null);
    this.previewText.set(text);
  }

  closePreview(): void {
    this.previewImageSrc.set(null);
    this.previewText.set(null);
  }

  hasScreenshot(raw: string | null): boolean {
    return !!this.resolveScreenshotSrc(raw);
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
    return this.sortColumn() === 'createdAt' ? 'created_at' : 'event_date';
  }

  private resolveScreenshotSrc(raw: string | null): string | null {
    const value = (raw ?? '').trim();
    if (!value) {
      return null;
    }
    if (value.startsWith('data:image/')) {
      return value;
    }
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
      return value;
    }
    return `data:image/png;base64,${value}`;
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

    const params = new HttpParams()
      .set('page', String(this.pageIndex()))
      .set('size', String(this.pageSize()))
      .set('sortBy', this.sortByApi())
      .set('sortDir', this.sortDir());

    this.http.get<EventCrawlFailedPage>('/data/event-crawl-failed', {params}).subscribe({
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

import {Component, inject, signal} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {DecimalPipe} from '@angular/common';

export interface EventDataIssueRow {
  eventId: number;
  issueType: string | null;
  description: string | null;
  hasScreenshot: boolean;
  recordedAt: string | null;
  eventName: string | null;
  eventDate: string | null;
  status: string | null;
  eventLink: string | null;
}

export interface EventDataIssuePage {
  content: EventDataIssueRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface EventDataIssueScreenshotResponse {
  eventId: number;
  issueType: string;
  recordedAt: string;
  screenshot: string;
}

export type EventDataIssueSortColumn = 'recordedAt' | 'eventDate';
export type EventDataIssueTypeFilter = 'all' | 'missing_stats' | 'missing_odds' | 'cancelled';

@Component({
  selector: 'app-event-data-issue',
  imports: [DecimalPipe],
  templateUrl: './event-data-issue.html',
  styleUrl: './event-data-issue.css',
  standalone: true
})
export class EventDataIssue {
  private readonly http = inject(HttpClient);
  readonly clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<EventDataIssuePage | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly sortColumn = signal<EventDataIssueSortColumn>('recordedAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly issueType = signal<EventDataIssueTypeFilter>('all');
  readonly previewImageSrc = signal<string | null>(null);
  readonly previewText = signal<string | null>(null);
  readonly previewLoading = signal(false);

  constructor() {
    this.load();
  }

  sortHeaderIcon(column: EventDataIssueSortColumn): string {
    if (this.sortColumn() !== column) {
      return 'unfold_more';
    }
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  sortHeaderActive(column: EventDataIssueSortColumn): boolean {
    return this.sortColumn() === column;
  }

  toggleSort(column: EventDataIssueSortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(column);
      this.sortDir.set('desc');
    }
    this.pageIndex.set(0);
    this.load();
  }

  onIssueTypeChange(value: string): void {
    const next = (value ?? 'all') as EventDataIssueTypeFilter;
    this.issueType.set(next);
    this.pageIndex.set(0);
    this.load();
  }

  issueTypeLabel(value: string | null): string {
    const key = (value ?? '').trim().toLowerCase();
    if (key === 'missing_stats') {
      return 'Missing stats';
    }
    if (key === 'missing_odds') {
      return 'Missing odds';
    }
    if (key === 'cancelled') {
      return 'Cancelled';
    }
    return value ?? '—';
  }

  rowTrack(row: EventDataIssueRow): string {
    return `${row.eventId}-${row.issueType ?? 'unknown'}`;
  }

  openScreenshotPreview(row: EventDataIssueRow): void {
    if (!row.hasScreenshot || !row.recordedAt || !row.issueType) {
      return;
    }
    this.previewLoading.set(true);
    this.previewText.set(null);
    this.previewImageSrc.set(null);

    const params = new HttpParams()
      .set('eventId', String(row.eventId))
      .set('issueType', row.issueType)
      .set('recordedAt', row.recordedAt);

    this.http.get<EventDataIssueScreenshotResponse>('/data/event-data-issues/screenshot', {params}).subscribe({
      next: body => {
        const src = this.resolveScreenshotSrc(body?.screenshot ?? null);
        if (!src) {
          this.previewText.set('Không có screenshot cho bản ghi này.');
          this.previewLoading.set(false);
          return;
        }
        this.previewImageSrc.set(src);
        this.previewLoading.set(false);
      },
      error: err => {
        const message = err?.status === 404
          ? 'Không tìm thấy screenshot cho bản ghi này.'
          : (err?.error?.message ?? err?.message ?? 'Không tải được screenshot.');
        this.previewText.set(typeof message === 'string' ? message : 'Không tải được screenshot.');
        this.previewLoading.set(false);
      }
    });
  }

  openDescriptionPreview(text: string | null): void {
    const normalized = (text ?? '').trim();
    if (!normalized) {
      return;
    }
    this.previewImageSrc.set(null);
    this.previewText.set(normalized);
  }

  closePreview(): void {
    this.previewImageSrc.set(null);
    this.previewText.set(null);
    this.previewLoading.set(false);
  }

  hasScreenshot(row: EventDataIssueRow): boolean {
    return !!row.hasScreenshot;
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
    return this.sortColumn() === 'recordedAt' ? 'recorded_at' : 'event_date';
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

    let params = new HttpParams()
      .set('page', String(this.pageIndex()))
      .set('size', String(this.pageSize()))
      .set('sortBy', this.sortByApi())
      .set('sortDir', this.sortDir());

    if (this.issueType() !== 'all') {
      params = params.set('issueType', this.issueType());
    }

    this.http.get<EventDataIssuePage>('/data/event-data-issues', {params}).subscribe({
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

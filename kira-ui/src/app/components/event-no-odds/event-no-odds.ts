import {Component, inject, signal} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {DatePipe, DecimalPipe} from '@angular/common';

export interface EventNoOddsRow {
  eventId: number;
  recordedAt: string | null;
  eventName: string | null;
  eventDate: string | null;
  status: string | null;
  link: string | null;
}

export interface EventNoOddsPage {
  content: EventNoOddsRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type EventNoOddsSortColumn = 'recordedAt' | 'eventDate';

@Component({
  selector: 'app-event-no-odds',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './event-no-odds.html',
  styleUrl: './event-no-odds.css',
  standalone: true
})
export class EventNoOdds {
  private readonly http = inject(HttpClient);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<EventNoOddsPage | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly sortColumn = signal<EventNoOddsSortColumn>('recordedAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  constructor() {
    this.load();
  }

  sortHeaderIcon(column: EventNoOddsSortColumn): string {
    if (this.sortColumn() !== column) {
      return 'unfold_more';
    }
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  sortHeaderActive(column: EventNoOddsSortColumn): boolean {
    return this.sortColumn() === column;
  }

  toggleSort(column: EventNoOddsSortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(column);
      this.sortDir.set('desc');
    }
    this.pageIndex.set(0);
    this.load();
  }

  private sortByApi(): string {
    return this.sortColumn() === 'recordedAt' ? 'recorded_at' : 'event_date';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const params = new HttpParams()
      .set('page', String(this.pageIndex()))
      .set('size', String(this.pageSize()))
      .set('sortBy', this.sortByApi())
      .set('sortDir', this.sortDir());

    this.http.get<EventNoOddsPage>('/data/event-no-odds', {params}).subscribe({
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

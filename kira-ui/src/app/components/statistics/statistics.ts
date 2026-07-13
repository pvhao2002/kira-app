import {DecimalPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {catchError, of} from 'rxjs';
import {
  PredictionLinePairStats,
  PredictionPeriodStats,
  PredictionStatisticsApiService,
  PredictionStatisticsResponse
} from '../../services/prediction-statistics-api.service';

type PeriodMode = 'daily' | 'weekly' | 'monthly';

@Component({
  selector: 'app-statistics',
  imports: [DecimalPipe, FormsModule, RouterLink],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Statistics {
  private readonly api = inject(PredictionStatisticsApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<PredictionStatisticsResponse | null>(null);
  readonly periodMode = signal<PeriodMode>('daily');
  readonly selectedVersionId = signal<number | null>(null);
  readonly from = signal<string>('');
  readonly to = signal<string>('');
  readonly clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';

  readonly periodRows = computed(() => {
    const body = this.data();
    if (!body) {
      return [];
    }
    return body[this.periodMode()] ?? [];
  });

  readonly maxPeriodVolume = computed(() => {
    const rows = this.periodRows();
    if (rows.length === 0) {
      return 1;
    }
    return Math.max(...rows.map(row => row.totalWins + row.totalLosses + row.totalVoids), 1);
  });

  constructor() {
    this.setQuickRange(90, false);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.get({
      versionId: this.selectedVersionId(),
      from: this.from() || null,
      to: this.to() || null,
    }).pipe(
      catchError(err => {
        const msg = err?.error?.message ?? err?.message ?? 'Unable to load prediction statistics.';
        this.error.set(typeof msg === 'string' ? msg : 'Unable to load prediction statistics.');
        return of<PredictionStatisticsResponse | null>(null);
      })
    ).subscribe(body => {
      if (body) {
        this.data.set(body);
        this.selectedVersionId.set(body.selectedVersion.predictionVersionId);
      }
      this.loading.set(false);
    });
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
      hour12: false,
      hourCycle: 'h23',
      timeZone: this.clientTimeZone,
    }).formatToParts(date);

    const part = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find(p => p.type === type)?.value ?? '00';

    return `${part('day')}-${part('month')}-${part('year')} ${part('hour')}:${part('minute')}`;
  }

  formatDateOnly(raw: string | null): string {
    const value = (raw ?? '').trim();
    if (!value) {
      return '—';
    }
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) {
      return value;
    }
    return `${day}-${month}-${year}`;
  }

  rowTrack(row: {teamId: number; rankNo: number}): string {
    return `${row.teamId}-${row.rankNo}`;
  }

  setPeriodMode(mode: PeriodMode): void {
    this.periodMode.set(mode);
  }

  setVersion(raw: string | number): void {
    const id = Number(raw);
    this.selectedVersionId.set(Number.isFinite(id) && id > 0 ? id : null);
  }

  setFrom(value: string): void {
    this.from.set(value);
  }

  setTo(value: string): void {
    this.to.set(value);
  }

  setQuickRange(days: number, reload = true): void {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days + 1);
    this.from.set(this.toDateInput(start));
    this.to.set(this.toDateInput(today));
    if (reload) {
      this.load();
    }
  }

  clearRange(): void {
    this.from.set('');
    this.to.set('');
    this.load();
  }

  periodLabel(): string {
    return {
      daily: 'Theo ngày',
      weekly: 'Theo tuần',
      monthly: 'Theo tháng',
    }[this.periodMode()];
  }

  periodTrack(row: PredictionPeriodStats): string {
    return `${this.periodMode()}-${row.periodStart}`;
  }

  lineTrack(row: PredictionLinePairStats): string {
    return `${row.prematchHdcLine}-${row.prematchOuLine}-${row.openHdcLine}-${row.openOuLine}`;
  }

  barHeight(row: PredictionPeriodStats): number {
    const total = row.totalWins + row.totalLosses + row.totalVoids;
    return Math.max((total / this.maxPeriodVolume()) * 100, total > 0 ? 5 : 0);
  }

  segmentPercent(value: number, row: PredictionPeriodStats): number {
    const total = row.totalWins + row.totalLosses + row.totalVoids;
    if (total <= 0) {
      return 0;
    }
    return (value / total) * 100;
  }

  formatDateTime(raw: string | null): string {
    if (!raw) {
      return '-';
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
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

  private toDateInput(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

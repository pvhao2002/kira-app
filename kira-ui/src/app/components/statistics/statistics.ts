import {DecimalPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {RouterLink} from '@angular/router';

type StatMetricType = 'TOTAL_GOALS_3_PLUS' | 'TOTAL_CORNERS_10_PLUS' | 'FIRST_HALF_GOAL';

interface SoccerTeamRecentStatRow {
  rankNo: number;
  teamId: number;
  teamName: string;
  eligibleMatchCount: number;
  matchedMatchCount: number;
  percentage: number;
  windowStart: string | null;
  windowEnd: string | null;
  computedAt: string | null;
}

interface SoccerTeamRecentStatGroup {
  metricType: StatMetricType;
  rows: SoccerTeamRecentStatRow[];
}

interface SoccerTeamRecentStatResponse {
  groups: SoccerTeamRecentStatGroup[];
}

interface StatSection {
  metricType: StatMetricType;
  title: string;
  description: string;
  icon: string;
  accentClass: string;
  rows: SoccerTeamRecentStatRow[];
}

const SECTION_META: Record<StatMetricType, Omit<StatSection, 'rows'>> = {
  TOTAL_GOALS_3_PLUS: {
    metricType: 'TOTAL_GOALS_3_PLUS',
    title: 'Top 10 teams with matches of 3+ goals',
    description: 'Share of matches in the last 3 months with 3+ total goals.',
    icon: 'scoreboard',
    accentClass: 'text-emerald-400',
  },
  TOTAL_CORNERS_10_PLUS: {
    metricType: 'TOTAL_CORNERS_10_PLUS',
    title: 'Top 10 teams with matches of 10+ corners',
    description: 'Share of matches in the last 3 months with 10+ total corners.',
    icon: 'sports',
    accentClass: 'text-amber-400',
  },
  FIRST_HALF_GOAL: {
    metricType: 'FIRST_HALF_GOAL',
    title: 'Top 10 teams with an H1 goal',
    description: 'Share of matches in the last 3 months with at least 1 first-half goal.',
    icon: 'timer',
    accentClass: 'text-sky-400',
  },
};

const METRIC_ORDER: StatMetricType[] = [
  'TOTAL_GOALS_3_PLUS',
  'TOTAL_CORNERS_10_PLUS',
  'FIRST_HALF_GOAL',
];

@Component({
  selector: 'app-statistics',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Statistics {
  private readonly http = inject(HttpClient);

  readonly clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<SoccerTeamRecentStatResponse | null>(null);

  readonly sections = computed<StatSection[]>(() => {
    const groups = this.data()?.groups ?? [];
    return METRIC_ORDER.map(metricType => {
      const group = groups.find(item => item.metricType === metricType);
      return {
        ...SECTION_META[metricType],
        rows: group?.rows ?? [],
      };
    });
  });

  readonly latestComputedAt = computed(() => {
    for (const section of this.sections()) {
      const computedAt = section.rows[0]?.computedAt;
      if (computedAt) {
        return computedAt;
      }
    }
    return null;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<SoccerTeamRecentStatResponse>('/data/soccer/team-recent-stats').subscribe({
      next: body => {
        this.data.set(body);
        this.loading.set(false);
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? 'Unable to load statistics data.';
        this.error.set(typeof msg === 'string' ? msg : 'Unable to load statistics data.');
        this.loading.set(false);
      },
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

  rowTrack(row: SoccerTeamRecentStatRow): string {
    return `${row.teamId}-${row.rankNo}`;
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
}

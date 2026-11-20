import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Filters, MARKETS, RESULTS } from '../core/models';
import { safeValue } from '../core/resource';
import { dayEndExclusive, dayStart, humanize } from './format';
import { fromQuery, toQuery } from './url-state';

const QUERY_KEYS = ['from', 'to', 'league', 'modelId', 'type', 'market', 'search', 'result'] as const;

export type FilterField = 'dates' | 'league' | 'model' | 'type' | 'market' | 'search' | 'result';

/** `YYYY-MM-DD` (from `<input type="date">`) as a local calendar day. */
export function localDay(v: string | null | undefined): Date | null {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Converts the form state to API filters (dates become [start of first day, start of the day after the last day)). */
export function toFilters(v: { from?: string | null; to?: string | null; league?: string | null; modelId?: string | null;
  type?: string | null; market?: string | null; search?: string | null; result?: string | null }): Filters {
  const start = localDay(v.from);
  const end = localDay(v.to);
  const first = start ?? end;
  return {
    from: first ? dayStart(first) : undefined,
    to: first ? dayEndExclusive(end ?? start!) : undefined,
    league: v.league?.trim() || undefined,
    modelId: v.modelId || undefined,
    type: (v.type || undefined) as Filters['type'],
    market: (v.market || undefined) as Filters['market'],
    search: v.search?.trim() || undefined,
    result: (v.result || undefined) as Filters['result'],
  };
}

/** Compact, collapsible filter panel shared by dashboard, predictions and reports. Emits once on init. */
@Component({
  selector: 'mm-filter-bar',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="filter-bar" [formGroup]="form" (ngSubmit)="apply()">
      <button type="button" class="filter-toggle" (click)="collapsed.set(!collapsed())" [attr.aria-expanded]="!collapsed()">
        <i class="pi pi-sliders-h"></i> Filters
        @if (activeCount()) { <span class="count">{{ activeCount() }}</span> }
        <i class="pi" [class.pi-chevron-down]="collapsed()" [class.pi-chevron-up]="!collapsed()"></i>
      </button>
      @if (!collapsed()) {
        <div class="filter-fields">
          @if (has('search')) {
            <input class="input f-search" formControlName="search" placeholder="Team, league or match id" aria-label="Search" />
          }
          @if (has('dates')) {
            <span class="date-range">
              <input class="input" type="date" formControlName="from" aria-label="From date" />
              <span aria-hidden="true">–</span>
              <input class="input" type="date" formControlName="to" aria-label="To date" />
            </span>
          }
          @if (has('league')) {
            <input class="input f-select" formControlName="league" list="mm-leagues" placeholder="All leagues" aria-label="League" />
            <datalist id="mm-leagues">@for (l of leagues(); track l) { <option [value]="l"></option> }</datalist>
          }
          @if (has('model')) {
            <select class="input f-select" formControlName="modelId" aria-label="AI model">
              <option value="">All AI models</option>
              @for (m of models(); track m.value) { <option [value]="m.value">{{ m.label }}</option> }
            </select>
          }
          @if (has('type')) {
            <select class="input f-select-sm" formControlName="type" aria-label="Prediction type">
              <option value="">Pre-match & live</option><option value="PRE_MATCH">Pre-match</option><option value="LIVE">Live</option>
            </select>
          }
          @if (has('market')) {
            <select class="input f-select-sm" formControlName="market" aria-label="Market">
              <option value="">All markets</option>
              @for (m of markets; track m) { <option [value]="m">{{ m }}</option> }
            </select>
          }
          @if (has('result')) {
            <select class="input f-select-sm" formControlName="result" aria-label="Top pick result" title="Result of the top-ranked pick of each prediction">
              <option value="">Any top result</option>
              @for (r of results; track r.value) { <option [value]="r.value">{{ r.label }}</option> }
            </select>
          }
          <span class="filter-actions">
            <button type="submit" class="btn btn-primary btn-sm"><i class="pi pi-check"></i> Apply</button>
            <button type="button" class="btn btn-text btn-sm" (click)="reset()">Reset</button>
          </span>
        </div>
      }
    </form>`,
})
export class FilterBar implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly fields = input<FilterField[]>(['dates', 'league', 'model', 'type', 'market']);
  /** Default date range: the last N days including today. */
  readonly initialDays = input<number | null>(null);
  readonly changed = output<Filters>();

  readonly collapsed = signal(typeof window !== 'undefined' && window.innerWidth < 760);
  readonly leagues = safeValue(this.api.leaguesResource(() => this.has('league')), []);
  private readonly modelList = safeValue(this.api.modelsResource(() => this.has('model')), []);
  readonly models = computed(() => this.modelList().map(m => ({ label: `${m.name} ${m.version}`, value: m.id })));
  readonly activeCount = signal(0);
  readonly markets = MARKETS;
  readonly results = RESULTS.map(r => ({ label: humanize(r), value: r }));
  private readonly fieldSet = computed(() => new Set(this.fields()));

  readonly form = this.fb.nonNullable.group({ from: '', to: '', league: '', modelId: '', type: '', market: '', search: '', result: '' });

  ngOnInit(): void {
    // The URL wins over the defaults, so a shared or refreshed link shows the same filtered view.
    this.form.patchValue({ ...this.defaults(), ...fromQuery(this.route.snapshot.queryParamMap, QUERY_KEYS) });
    this.apply(false);
  }

  has(f: FilterField): boolean { return this.fieldSet().has(f); }

  current(): Filters { return toFilters(this.form.getRawValue()); }

  /** `updateUrl` is false for the first load, which should not rewrite the address bar. */
  apply(updateUrl = true): void {
    const f = this.current();
    this.activeCount.set(Object.values(f).filter(v => v !== undefined).length);
    this.changed.emit(f);
    if (updateUrl) this.writeUrl();
  }

  private writeUrl(): void {
    const v = this.form.getRawValue();
    const hasDefaultDates = !!this.initialDays();
    const values: Record<string, string | null> = {};
    for (const k of QUERY_KEYS) {
      const date = k === 'from' || k === 'to';
      values[k] = !this.has(date ? 'dates' : k === 'modelId' ? 'model' : k) ? null : v[k].trim() || (date && hasDefaultDates ? '' : null);
    }
    toQuery(this.router, this.route, values);
  }

  reset(): void {
    this.form.reset();
    this.form.patchValue(this.defaults());
    this.apply();
  }

  private defaults(): { from: string; to: string } {
    const days = this.initialDays();
    if (!days) return { from: '', to: '' };
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));
    return { from: isoDay(start), to: isoDay(end) };
  }
}

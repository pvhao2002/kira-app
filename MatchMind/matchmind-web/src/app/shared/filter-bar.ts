import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Filters, MARKETS, RESULTS } from '../core/models';
import { safeValue } from '../core/resource';
import { DateInput, DateRange } from './date-picker';
import { Select, SelectOption } from './select';
import { dayEndExclusive, dayStart, humanize } from './format';
import { fromQuery, toQuery } from './url-state';

const QUERY_KEYS = ['from', 'to', 'league', 'modelId', 'type', 'market', 'search', 'result', 'resultScope', 'count'] as const;

/**
 * `resultScope` (Predictions only): the result filter matches the top pick (default) or any pick.
 * `count` (aggregate pages only, UX-046): `?count=all` sends `countPolicy=all`; the default counts the latest per moment.
 */
export type FilterField = 'dates' | 'league' | 'model' | 'type' | 'market' | 'search' | 'result' | 'resultScope' | 'count';

/** What the bar emits: the shared filters, plus `resultScope` when the page offers it. */
export type BarFilters = Filters & { resultScope?: 'TOP' | 'ANY' };

export const DATE_RANGE_ERROR = 'From must be on or before To.';

/** `YYYY-MM-DD` (from `<input type="date">`) as a local calendar day. */
export function localDay(v: string | null | undefined): Date | null {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Picked days as API bounds: [start of From, start of the day after To). Only From = from that day on, only To = up to
 * the end of that day. `error` when From is after To (nothing should be sent then).
 */
export function dayRange(from: string | null | undefined, to: string | null | undefined): { from?: string; to?: string; error?: string } {
  const start = localDay(from);
  const end = localDay(to);
  if (start && end && start > end) return { error: DATE_RANGE_ERROR };
  return { from: start ? dayStart(start) : undefined, to: end ? dayEndExclusive(end) : undefined };
}

/** Converts the form state to API filters (an invalid date range is left out; the bar refuses to apply it). */
export function toFilters(v: { from?: string | null; to?: string | null; league?: string | null; modelId?: string | null;
  type?: string | null; market?: string | null; search?: string | null; result?: string | null }): Filters {
  const range = dayRange(v.from, v.to);
  return {
    from: range.from,
    to: range.to,
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
  imports: [ReactiveFormsModule, DateInput, DateRange, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="filter-bar" [formGroup]="form" (ngSubmit)="apply()">
      <button type="button" class="filter-toggle" (click)="collapsed.set(!collapsed())" [attr.aria-expanded]="!collapsed()">
        <i class="pi pi-sliders-h" aria-hidden="true"></i> Filters
        @if (activeCount()) { <span class="count">{{ activeCount() }}</span> }
        @if (pending()) { <span class="pending-note">· not applied</span> }
        <i class="pi" [class.pi-chevron-down]="collapsed()" [class.pi-chevron-up]="!collapsed()" aria-hidden="true"></i>
      </button>
      @if (!collapsed()) {
        <div class="filter-fields">
          @if (has('search')) {
            <input class="input f-search" formControlName="search" placeholder="Team, league or match id" aria-label="Search" />
          }
          @if (has('dates')) {
            <mm-date-range>
              <mm-date-input formControlName="from" />
              <mm-date-input formControlName="to" />
            </mm-date-range>
          }
          @if (has('league')) {
            <input class="input f-select" formControlName="league" list="mm-leagues" placeholder="All leagues" aria-label="League" />
            <datalist id="mm-leagues">@for (l of leagues(); track l) { <option [value]="l"></option> }</datalist>
          }
          @if (has('model')) {
            <mm-select class="f-select" formControlName="modelId" ariaLabel="AI model" [options]="modelOptions()" />
          }
          @if (has('type')) {
            <mm-select class="f-select-sm" formControlName="type" ariaLabel="Prediction type" [options]="typeOptions" />
          }
          @if (has('market')) {
            <mm-select class="f-select-sm" formControlName="market" ariaLabel="Market" [options]="marketOptions" />
          }
          @if (has('result')) {
            <mm-select class="f-select-sm" formControlName="result" [ariaLabel]="resultLabel()" [options]="resultOptions" />
          }
          @if (has('resultScope')) {
            <mm-select class="f-select-sm" formControlName="resultScope" ariaLabel="Result applies to" aria-describedby="fb-scope-hint" [options]="scopeOptions" />
            <span id="fb-scope-hint" class="sr-only">Match the result of the top-ranked pick, or of any pick of the prediction</span>
          }
          @if (has('count')) {
            <mm-select class="f-select" formControlName="count" ariaLabel="Count" aria-describedby="fb-count-hint" [options]="countOptions" />
            <span id="fb-count-hint" class="sr-only">Latest per moment: a re-sent prediction counts once (the latest per match, model, type and minute). All: every stored row</span>
          }
          <span class="filter-actions">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="!!dateError()"><i class="pi pi-check" aria-hidden="true"></i> Apply</button>
            <button type="button" class="btn btn-text btn-sm" (click)="reset()">Reset</button>
            @if (pending()) { <span class="pending-note" role="status">Changes not applied</span> }
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
  /** Extends the default range past today by this many days (e.g. 1 = up to tomorrow, for kick-off times). */
  readonly daysAhead = input(0);
  readonly changed = output<BarFilters>();

  /** Starts collapsed on phones and on short (landscape) screens, where an open panel would hide the table. */
  readonly collapsed = signal(typeof window !== 'undefined' && (window.innerWidth < 760 || window.innerHeight <= 500));
  readonly leagues = safeValue(this.api.leaguesResource(() => this.has('league')), []);
  private readonly modelList = safeValue(this.api.modelsResource(() => this.has('model')), []);
  readonly models = computed(() => this.modelList().map(m => ({ label: `${m.displayName ?? m.name} ${m.version}`, value: m.id })));
  readonly activeCount = signal(0);
  // mm-select options. The "All"/"Any" first option has the empty value, which the form and the URL treat as "no filter".
  readonly modelOptions = computed<SelectOption[]>(() => [{ value: '', label: 'All AI models' }, ...this.models()]);
  readonly typeOptions: SelectOption[] = [{ value: '', label: 'Pre-match & live' }, { value: 'PRE_MATCH', label: 'Pre-match' }, { value: 'LIVE', label: 'Live' }];
  readonly marketOptions: SelectOption[] = [{ value: '', label: 'All markets' }, ...MARKETS.map(m => ({ value: m, label: m }))];
  // The aria-label names the scope (top pick or any pick), so the visible text can stay short enough for the trigger (DS-8).
  readonly resultOptions: SelectOption[] = [{ value: '', label: 'Any result' }, ...RESULTS.map(r => ({ value: r, label: humanize(r) }))];
  readonly scopeOptions: SelectOption[] = [{ value: '', label: 'Top pick' }, { value: 'ANY', label: 'Any pick' }];
  readonly countOptions: SelectOption[] = [{ value: '', label: 'Count: latest' }, { value: 'all', label: 'Count: all' }];
  private readonly fieldSet = computed(() => new Set(this.fields()));

  readonly form = this.fb.nonNullable.group({ from: '', to: '', league: '', modelId: '', type: '', market: '', search: '', result: '', resultScope: '', count: '' });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  /** The form as of the last Apply; edits since then are shown as not applied. */
  private readonly applied = signal(JSON.stringify(this.form.getRawValue()));
  readonly pending = computed(() => JSON.stringify({ ...this.form.getRawValue(), ...this.value() }) !== this.applied());
  private readonly dateRange = viewChild(DateRange);
  readonly dateError = computed(() => this.dateRange()?.error() || dayRange(this.value().from, this.value().to).error || '');
  private readonly scope = computed(() => this.has('resultScope') ? (this.value().resultScope === 'ANY' ? 'ANY' : 'TOP') : null);
  readonly resultLabel = computed(() => this.scope() === 'TOP' ? 'Top pick result' : 'Pick result');

  ngOnInit(): void {
    // The URL wins over the defaults, so a shared or refreshed link shows the same filtered view.
    this.form.patchValue({ ...this.defaults(), ...fromQuery(this.route.snapshot.queryParamMap, QUERY_KEYS) });
    this.apply(false);
  }

  has(f: FilterField): boolean { return this.fieldSet().has(f); }

  current(): BarFilters {
    const v = this.form.getRawValue();
    const f: BarFilters = toFilters(v);
    if (this.has('resultScope') && v.resultScope === 'ANY') f.resultScope = 'ANY';
    if (this.has('count') && v.count === 'all') f.countPolicy = 'all';
    return f;
  }

  /** `updateUrl` is false for the first load, which should not rewrite the address bar. Refuses From after To. */
  apply(updateUrl = true): void {
    if (this.dateError()) return;
    const v = this.form.getRawValue();
    const f = this.current();
    this.applied.set(JSON.stringify(v));
    // The badge counts the date range once, and not at all while it is the page's default range.
    const d = this.defaults();
    const dates = (!!f.from || !!f.to) && !(v.from === d.from && v.to === d.to);
    const others = Object.entries(f).filter(([k, x]) => k !== 'from' && k !== 'to' && x !== undefined).length;
    this.activeCount.set(others + (dates ? 1 : 0));
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
      if (k === 'resultScope') values[k] = this.has(k) && v[k] === 'ANY' ? 'ANY' : null;
      if (k === 'count') values[k] = this.has(k) && v[k] === 'all' ? 'all' : null;
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
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + this.daysAhead());
    return { from: isoDay(start), to: isoDay(end) };
  }
}

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Filters, MARKETS, RESULTS } from '../core/models';
import { dayEndExclusive, dayStart, humanize } from './format';

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
            <select class="input f-select-sm" formControlName="result" aria-label="Result">
              <option value="">Any result</option>
              @for (r of results; track r.value) { <option [value]="r.value">{{ r.label }}</option> }
            </select>
          }
          <button type="submit" class="btn btn-primary btn-sm"><i class="pi pi-check"></i> Apply</button>
          <button type="button" class="btn btn-text btn-sm" (click)="reset()">Reset</button>
        </div>
      }
    </form>`,
})
export class FilterBar implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly fields = input<FilterField[]>(['dates', 'league', 'model', 'type', 'market']);
  /** Default date range: the last N days including today. */
  readonly initialDays = input<number | null>(null);
  readonly changed = output<Filters>();

  readonly collapsed = signal(typeof window !== 'undefined' && window.innerWidth < 760);
  readonly leagues = signal<string[]>([]);
  readonly models = signal<{ label: string; value: string }[]>([]);
  readonly activeCount = signal(0);
  readonly markets = MARKETS;
  readonly results = RESULTS.map(r => ({ label: humanize(r), value: r }));
  private readonly fieldSet = computed(() => new Set(this.fields()));

  readonly form = this.fb.nonNullable.group({ from: '', to: '', league: '', modelId: '', type: '', market: '', search: '', result: '' });

  ngOnInit(): void {
    this.form.patchValue(this.defaults());
    if (this.has('league')) this.api.leagues().subscribe({ next: l => this.leagues.set(l), error: () => undefined });
    if (this.has('model')) {
      this.api.models().subscribe({
        next: ms => this.models.set(ms.map(m => ({ label: `${m.name} ${m.version}`, value: m.id }))),
        error: () => undefined,
      });
    }
    this.apply(); // initial load uses the default filters
  }

  has(f: FilterField): boolean { return this.fieldSet().has(f); }

  current(): Filters { return toFilters(this.form.getRawValue()); }

  apply(): void {
    const f = this.current();
    this.activeCount.set(Object.values(f).filter(v => v !== undefined).length);
    this.changed.emit(f);
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

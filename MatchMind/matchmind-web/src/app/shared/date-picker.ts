import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, ViewEncapsulation, afterNextRender, computed, contentChildren,
  forwardRef, inject, input, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { APP_LOCALE } from './format';

// Local calendar days only. Never go through Date.toISOString(): east of UTC (UTC+7) it moves the day back by one.
// ponytail: same job as localDay()/isoDay() in filter-bar.ts; not imported from there because filter-bar will import
// this file (circular import). Move both into format.ts if a third copy is ever needed.

/** `YYYY-MM-DD` as a local Date, or null when it is not a real calendar day. */
export function parseIso(v: string | null | undefined): Date | null {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` -> "23/11/2026", the typed format (en-GB numeric, matching `APP_LOCALE`). */
export function fmtDay(iso: string): string {
  const d = parseIso(iso);
  return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : iso;
}

/** Typed text -> `YYYY-MM-DD`; '' for empty text, null when it is not a date. Takes d/m/yyyy (any of / . -) or yyyy-mm-dd. */
export function parseTyped(text: string): string | null {
  const t = text.trim();
  if (!t) return '';
  if (parseIso(t)) return t;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return parseIso(iso) ? iso : null;
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso)!;
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Same day n months later, clamped to the last day of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const d = parseIso(iso)!;
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return toIso(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)));
}

/** Monday = 0 … Sunday = 6. */
const weekday = (d: Date) => (d.getDay() + 6) % 7;

/** Grid keys: arrows day/week, PageUp/PageDown month (Shift: year), Home/End week start/end. null = not a move key. */
export function moveKey(iso: string, key: string, shift = false): string | null {
  switch (key) {
    case 'ArrowLeft': return addDays(iso, -1);
    case 'ArrowRight': return addDays(iso, 1);
    case 'ArrowUp': return addDays(iso, -7);
    case 'ArrowDown': return addDays(iso, 7);
    case 'PageUp': return addMonths(iso, shift ? -12 : -1);
    case 'PageDown': return addMonths(iso, shift ? 12 : 1);
    case 'Home': return addDays(iso, -weekday(parseIso(iso)!));
    case 'End': return addDays(iso, 6 - weekday(parseIso(iso)!));
    default: return null;
  }
}

export type DatePreset = 'today' | 'last7' | 'last30' | 'month';
export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'last7', label: 'Last 7 days' }, { id: 'last30', label: 'Last 30 days' }, { id: 'month', label: 'This month' },
];

/** [from, to] of a preset; "Last 7 days" includes today. */
export function presetRange(p: DatePreset, now = new Date()): [string, string] {
  const t = toIso(now);
  switch (p) {
    case 'today': return [t, t];
    case 'last7': return [addDays(t, -6), t];
    case 'last30': return [addDays(t, -29), t];
    case 'month': return [toIso(new Date(now.getFullYear(), now.getMonth(), 1)), toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
  }
}

/** Same text as filter-bar's DATE_RANGE_ERROR. */
export const DATE_ORDER_ERROR = 'From must be on or before To.';

const monthTitle = new Intl.DateTimeFormat(APP_LOCALE, { month: 'long', year: 'numeric' });
const longDay = new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortMonth = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short' });
const WEEKDAYS = [['Mo', 'Monday'], ['Tu', 'Tuesday'], ['We', 'Wednesday'], ['Th', 'Thursday'], ['Fr', 'Friday'], ['Sa', 'Saturday'], ['Su', 'Sunday']];
const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

interface Cell { iso: string; day: number; label: string; out: boolean; today: boolean; disabled: boolean; }

let nextId = 0;

/**
 * Typed date field + calendar popup. Value: a `YYYY-MM-DD` string ('' when empty), the same as `<input type="date">`.
 * Works with `formControlName` and `[(ngModel)]`. Inside `<mm-date-range>` the popup picks the whole range.
 */
@Component({
  selector: 'mm-date-input',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, CdkTrapFocus],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInput), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,   // the popup pane lives in the overlay, outside this host
  host: { class: 'mm-date-input' },
  template: `
    <span class="mm-dp" cdkOverlayOrigin #origin="cdkOverlayOrigin">
      @if (visibleLabel()) { <label class="mm-dp-label" [for]="id">{{ visibleLabel() }}</label> }
      <span class="mm-dp-field">
        <input #textInput class="input" type="text" autocomplete="off" [id]="id" [value]="text()"
          [placeholder]="placeholder()" [attr.aria-label]="ariaLabel() || null" [attr.aria-invalid]="invalid() || null"
          [attr.aria-describedby]="describedBy()" [disabled]="disabled()"
          (input)="text.set(textInput.value)" (blur)="commit()" (keydown.enter)="commit()" (keydown.alt.arrowdown)="openPopup()" />
        <span class="mm-dp-btns">
          @if (value() && !disabled()) {
            <button type="button" class="mm-dp-btn" (click)="clear()" [attr.aria-label]="'Clear ' + name()"><i class="pi pi-times" aria-hidden="true"></i></button>
          }
          <button #trigger type="button" class="mm-dp-btn" (click)="toggle()" [disabled]="disabled()" aria-haspopup="dialog"
            [attr.aria-expanded]="open()" [attr.aria-label]="'Choose ' + name()"><i class="pi pi-calendar" aria-hidden="true"></i></button>
        </span>
      </span>
    </span>
    @if (!range && parseError()) { <span class="field-error" [id]="id + '-err'" role="alert">{{ parseError() }}</span> }

    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions" cdkConnectedOverlayPanelClass="mm-dp-pane" cdkConnectedOverlayUsePopover="inline"
      (overlayOutsideClick)="onOutside($event)" (overlayKeydown)="onOverlayKey($event)" (detach)="onDetach()">
      <div class="mm-dp-pop" role="dialog" [attr.aria-label]="dialogLabel()" cdkTrapFocus>
        @if (range) {
          <div class="mm-dp-presets" role="group" aria-label="Presets">
            @for (p of presets; track p.id) { <button type="button" class="chip" [disabled]="!presetFor(p.id)" (click)="applyPreset(p.id)">{{ p.label }}</button> }
          </div>
        }
        <div class="mm-dp-head">
          <button type="button" class="btn btn-text btn-icon btn-sm" (click)="step(-1)" [attr.aria-label]="view() === 'days' ? 'Previous month' : 'Previous year'"><i class="pi pi-chevron-left" aria-hidden="true"></i></button>
          <button type="button" class="btn btn-text btn-sm mm-dp-title" aria-live="polite" (click)="view.set(view() === 'days' ? 'months' : 'days')"
            [attr.aria-label]="(view() === 'days' ? title() : year()) + ', choose ' + (view() === 'days' ? 'month' : 'day')">{{ view() === 'days' ? title() : year() }}</button>
          <button type="button" class="btn btn-text btn-icon btn-sm" (click)="step(1)" [attr.aria-label]="view() === 'days' ? 'Next month' : 'Next year'"><i class="pi pi-chevron-right" aria-hidden="true"></i></button>
          @if (!range) { <button type="button" class="btn btn-text btn-sm" (click)="pick(todayIso())" [disabled]="outOfBounds(todayIso())">Today</button> }
        </div>
        @if (view() === 'days') {
          <div #grid class="mm-dp-grid" role="grid" tabindex="0" [attr.aria-label]="title()" [attr.aria-activedescendant]="id + '-' + active()"
            (keydown)="onGridKey($event)" (mouseleave)="hover.set('')">
            <div class="mm-dp-row" role="row">
              @for (w of weekdays; track w[0]) { <span class="mm-dp-wd" role="columnheader" [attr.aria-label]="w[1]">{{ w[0] }}</span> }
            </div>
            @for (week of weeks(); track $index) {
              <div class="mm-dp-row" role="row">
                @for (c of week; track c.iso) {
                  <div class="mm-dp-day" role="gridcell" [id]="id + '-' + c.iso" [attr.aria-label]="c.label"
                    [attr.aria-selected]="isSelected(c.iso)" [attr.aria-disabled]="c.disabled || null" [attr.aria-current]="c.today ? 'date' : null"
                    [class.out]="c.out" [class.today]="c.today" [class.sel]="isSelected(c.iso)" [class.band]="inBand(c.iso)" [class.active]="c.iso === active()"
                    (click)="pick(c.iso)" (mouseenter)="hover.set(c.iso)">{{ c.day }}</div>
                }
              </div>
            }
          </div>
        } @else {
          <div class="mm-dp-months">
            @for (m of months(); track m.iso) {
              <button type="button" class="btn btn-text btn-sm" [class.mm-dp-cur]="m.current" (click)="pickMonth(m.iso)">{{ m.label }}</button>
            }
          </div>
        }
      </div>
    </ng-template>`,
  styles: `
    .mm-date-input { display: inline-flex; flex-direction: column; min-width: 0; }
    .mm-dp { display: inline-flex; align-items: center; gap: var(--sp-2); min-width: 0; }
    .mm-dp-label { color: var(--mm-ink-2); font-size: var(--fs-sm); font-weight: 500; white-space: nowrap; }
    .mm-dp-field { position: relative; display: inline-flex; flex: 1; min-width: 0; }
    .mm-dp-field > .input { width: 10.5rem; flex: 1; min-width: 0; padding-right: 4.3rem; font-variant-numeric: tabular-nums; }
    .mm-dp-btns { position: absolute; top: 0; right: 2px; bottom: 0; display: flex; align-items: center; }
    .mm-dp-btn {
      display: grid; place-items: center; width: 2rem; height: 2rem; border: 0; border-radius: 6px; background: transparent;
      color: var(--mm-ink-2); cursor: pointer; font-size: var(--fs-sm);
    }
    .mm-dp-btn:hover:not(:disabled) { background: var(--mm-surface-3); color: var(--mm-ink); }
    .mm-dp-btn:focus-visible { outline: 2px solid var(--mm-accent-ui); outline-offset: -2px; }
    .mm-dp-btn:disabled { color: var(--mm-ink-3); cursor: not-allowed; }

    .mm-dp-pop {
      background: var(--mm-card-solid); border: 1px solid var(--mm-line-2); border-radius: var(--mm-radius); box-shadow: var(--mm-shadow-lg);
      padding: var(--sp-3); color: var(--mm-ink); font-size: var(--fs-sm); animation: mm-dp-in .12s var(--mm-ease);
    }
    @keyframes mm-dp-in { from { opacity: 0; transform: translateY(-4px); } }
    .mm-dp-presets { display: flex; flex-wrap: wrap; gap: var(--sp-1); margin-bottom: var(--sp-2); }
    .mm-dp-head { display: flex; align-items: center; gap: var(--sp-1); margin-bottom: var(--sp-1); }
    .mm-dp-title { flex: 1; color: var(--mm-ink); font-weight: 600; }
    .mm-dp-grid { border-radius: 8px; }
    .mm-dp-grid:focus { outline: none; }
    .mm-dp-row { display: grid; grid-template-columns: repeat(7, 2.25rem); }
    .mm-dp-wd { padding: var(--sp-1) 0; color: var(--mm-ink-3); font-size: var(--fs-xs); font-weight: 600; text-align: center; }
    .mm-dp-day {
      display: grid; place-items: center; height: 2.25rem; border-radius: 8px; cursor: pointer; font-variant-numeric: tabular-nums;
    }
    .mm-dp-day:hover { background: var(--mm-surface-3); }
    .mm-dp-day.out { color: var(--mm-ink-3); }
    .mm-dp-day.today { box-shadow: inset 0 0 0 1.5px var(--mm-accent-ui); }
    .mm-dp-day.band { background: var(--mm-green-soft); color: var(--mm-green-ink); border-radius: 0; }
    .mm-dp-day.sel { background: var(--mm-green); color: #fff; font-weight: 600; }   /* white on --mm-green: 6.3:1, both themes */
    .mm-dp-day[aria-disabled="true"] { background: none; color: var(--mm-ink-3); cursor: not-allowed; text-decoration: line-through; }
    .mm-dp-grid:focus-visible .mm-dp-day.active { outline: 2px solid var(--mm-accent-ui); outline-offset: -2px; }
    .mm-dp-months { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-1); }
    .mm-dp-months .mm-dp-cur { background: var(--mm-green-soft); color: var(--mm-green-ink); }
    @media (pointer: coarse) {
      .mm-dp-row { grid-template-columns: repeat(7, 2.75rem); }
      .mm-dp-day { height: 2.75rem; }
    }
    @media (max-width: 640px) {
      .cdk-overlay-pane.mm-dp-pane {
        position: fixed !important; top: auto !important; right: 0 !important; bottom: 0 !important; left: 0 !important;
        width: 100% !important; max-width: 100% !important; transform: none !important;
      }
      .mm-dp-pane .mm-dp-pop { border-radius: var(--mm-radius) var(--mm-radius) 0 0; padding-bottom: calc(var(--sp-3) + env(safe-area-inset-bottom)); }
      .mm-dp-pane .mm-dp-row { grid-template-columns: repeat(7, 1fr); }
    }
    @media (prefers-reduced-motion: reduce) { .mm-dp-pop { animation: none; } }`,
})
export class DateInput implements ControlValueAccessor {
  /** Earliest / latest selectable day, `YYYY-MM-DD`. */
  readonly min = input('');
  readonly max = input('');
  readonly ariaLabel = input('');
  readonly placeholder = input('dd/mm/yyyy');
  /** Visible label before the field. Inside a range it defaults to "From" / "To". */
  readonly label = input('');

  /** Set when this field is one end of a `<mm-date-range>`. */
  readonly range = inject(DateRange, { optional: true });
  private readonly injector = inject(Injector);
  readonly id = `mm-date-${nextId++}`;
  readonly positions = POSITIONS;
  readonly presets = DATE_PRESETS;
  readonly weekdays = WEEKDAYS;

  readonly value = signal('');
  readonly text = signal('');
  readonly parseError = signal('');
  readonly disabled = signal(false);
  readonly open = signal(false);
  readonly view = signal<'days' | 'months'>('days');
  /** The grid's focused day (aria-activedescendant); its month is the one shown. */
  readonly active = signal(toIso(new Date()));
  readonly hover = signal('');

  private readonly textInput = viewChild.required<ElementRef<HTMLInputElement>>('textInput');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly visibleLabel = computed(() => this.label() || (this.range ? (this.range.inputs()[0] === this ? 'From' : 'To') : ''));
  /** Lower-case field name for the button labels: "Clear kick-off from", "Choose day". */
  readonly name = computed(() => (this.ariaLabel() || [this.range?.label(), this.visibleLabel()].filter(Boolean).join(' ') || 'date').toLowerCase());
  readonly dialogLabel = computed(() => this.range ? `Choose ${this.range.label().toLowerCase() || 'date'} range` : `Choose ${this.name()}`);
  readonly invalid = computed(() => !!this.parseError() || !!this.range?.orderError());
  readonly describedBy = computed(() => this.range ? (this.range.error() ? this.range.errorId : null) : (this.parseError() ? `${this.id}-err` : null));
  readonly title = computed(() => monthTitle.format(parseIso(this.active())!));
  readonly year = computed(() => this.active().slice(0, 4));
  readonly todayIso = () => toIso(new Date());

  /** Six Monday-first weeks around the active day's month. */
  readonly weeks = computed<Cell[][]>(() => {
    const a = parseIso(this.active())!;
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const today = this.todayIso();
    const weeks: Cell[][] = [];
    for (let w = 0; w < 6; w++) {
      weeks.push(Array.from({ length: 7 }, (_, i) => {
        const d = new Date(a.getFullYear(), a.getMonth(), 1 - weekday(first) + w * 7 + i);
        const iso = toIso(d);
        return { iso, day: d.getDate(), label: longDay.format(d), out: d.getMonth() !== a.getMonth(), today: iso === today, disabled: this.outOfBounds(iso) };
      }));
    }
    return weeks;
  });

  readonly months = computed(() => Array.from({ length: 12 }, (_, m) => {
    const iso = addMonths(this.active(), m - parseIso(this.active())!.getMonth());
    return { iso, label: shortMonth.format(parseIso(iso)!), current: iso === this.active() };
  }));

  /** Ends of the highlighted band: the range (or the pending pick to the hovered/active day), or nothing. */
  private readonly band = computed<[string, string] | null>(() => {
    const r = this.range;
    if (!r) return null;
    const a = r.anchor();
    if (a) { const b = this.hover() || this.active(); return a <= b ? [a, b] : [b, a]; }
    return r.from() && r.to() && r.from() <= r.to() ? [r.from(), r.to()] : null;
  });

  isSelected(iso: string): boolean {
    const r = this.range;
    if (!r) return iso === this.value();
    const b = this.band();
    return r.anchor() ? !!b && (iso === b[0] || iso === b[1]) : iso === r.from() || iso === r.to();
  }

  inBand(iso: string): boolean {
    const b = this.band();
    return !!b && iso > b[0] && iso < b[1];
  }

  outOfBounds(iso: string): boolean {
    const within = (input: DateInput, day: string) =>
      (!input.min() || day >= input.min()) && (!input.max() || day <= input.max());
    const [from, to] = this.range?.inputs() ?? [];
    if (!from || !to) return !within(this, iso);

    const anchor = this.range?.anchor();
    if (!anchor) {
      return (!!from.min() && iso < from.min()) || (!!to.max() && iso > to.max())
        || (!within(from, iso) && !within(to, iso));
    }
    return anchor <= iso ? !within(from, anchor) || !within(to, iso) : !within(from, iso) || !within(to, anchor);
  }

  // ---- ControlValueAccessor
  writeValue(v: string | null | undefined): void {
    const s = v ?? '';
    this.value.set(s);
    this.text.set(fmtDay(s));
    this.parseError.set('');
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
    if (d && this.open()) this.close(false);
  }

  /** Sets the value from the picker, a preset or Clear, and tells the form. */
  setValue(v: string): void {
    this.writeValue(v);
    this.onChange(v);
    this.onTouched();
  }

  /** Parses the typed text (on blur and Enter). Invalid text empties the value, as the native input does, and shows why. */
  commit(): void {
    this.onTouched();
    const iso = parseTyped(this.text());
    const error = iso === null ? 'Enter a date as dd/mm/yyyy.'
      : iso && this.min() && iso < this.min() ? `Pick ${fmtDay(this.min())} or later.`
      : iso && this.max() && iso > this.max() ? `Pick ${fmtDay(this.max())} or earlier.` : '';
    const next = error ? '' : iso!;
    if (next !== this.value()) { this.value.set(next); this.onChange(next); }
    this.parseError.set(error);
    if (!error) this.text.set(fmtDay(next));
  }

  clear(): void {
    this.setValue('');
    this.textInput().nativeElement.focus();
  }

  toggle(): void {
    if (this.open()) this.close(true); else this.openPopup();
  }

  openPopup(): void {
    if (this.disabled()) return;
    const start = this.value() || this.range?.from() || this.range?.to() || this.todayIso();
    this.active.set(parseIso(start) ? start : this.todayIso());
    this.view.set('days');
    this.hover.set('');
    this.range?.anchor.set('');
    this.open.set(true);
    afterNextRender(() => this.grid()?.nativeElement.focus(), { injector: this.injector });
  }

  /** The CDK can detach on its own (e.g. navigation); drop a half-made range pick too. */
  onDetach(): void {
    this.open.set(false);
    this.range?.anchor.set('');
  }

  close(returnFocus: boolean): void {
    this.open.set(false);
    this.range?.anchor.set('');
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  /** A click outside closes without moving focus; the calendar button toggles by itself. */
  onOutside(e: MouseEvent): void {
    if (!this.trigger().nativeElement.contains(e.target as Node)) this.close(false);
  }

  onOverlayKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.close(true); }
  }

  onGridKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(this.active()); return; }
    const next = moveKey(this.active(), e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    this.active.set(next);
  }

  /** Previous/next month (day view) or year (month view). */
  step(dir: number): void {
    this.active.set(addMonths(this.active(), dir * (this.view() === 'days' ? 1 : 12)));
  }

  pick(iso: string): void {
    if (this.outOfBounds(iso)) return;
    this.active.set(iso);
    if (!this.range) { this.setValue(iso); this.close(true); return; }
    if (this.range.pick(iso)) this.close(true);
  }

  /** Month view: show that month and put focus back in the grid (the focused month button is removed). */
  pickMonth(iso: string): void {
    this.active.set(iso);
    this.view.set('days');
    afterNextRender(() => this.grid()?.nativeElement.focus(), { injector: this.injector });
  }

  /** A preset clamped to From's `min` and To's `max`; null (button disabled) when nothing of it is left. */
  presetFor(p: DatePreset): [string, string] | null {
    const [f, t] = presetRange(p);
    const lo = this.range?.inputs()[0]?.min() ?? '';
    const hi = this.range?.inputs()[1]?.max() ?? '';
    const from = lo && f < lo ? lo : f;
    const to = hi && t > hi ? hi : t;
    return from <= to ? [from, to] : null;
  }

  applyPreset(p: DatePreset): void {
    const r = this.presetFor(p);
    if (!r) return;
    this.range?.setRange(...r);
    this.close(true);
  }
}

/**
 * From/To pair around two projected `<mm-date-input>`s (first = From, second = To), so each end keeps its own
 * `formControlName` / `[(ngModel)]` and the stored values stay `YYYY-MM-DD`. Either calendar button opens the range
 * picker (first click From, second To, presets). Shows "From must be on or before To." and marks both fields invalid.
 */
@Component({
  selector: 'mm-date-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'mm-date-range' },
  template: `
    <span class="mm-dr" role="group" [attr.aria-labelledby]="label() ? errorId + '-l' : null" [attr.aria-label]="label() ? null : 'Date range'">
      @if (label()) { <span class="mm-dr-label" [id]="errorId + '-l'">{{ label() }}</span> }
      <ng-content />
    </span>
    @if (error()) { <span class="field-error" [id]="errorId" role="alert">{{ error() }}</span> }`,
  styles: `
    .mm-date-range { display: inline-flex; flex-direction: column; min-width: 0; }
    .mm-dr { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); min-width: 0; }
    .mm-dr-label { color: var(--mm-ink-2); font-size: var(--fs-sm); font-weight: 600; white-space: nowrap; }`,
})
export class DateRange {
  /** Visible name of the range, e.g. "Kick-off" or "Received". */
  readonly label = input('');

  readonly inputs = contentChildren(DateInput);
  readonly errorId = `mm-range-${nextId++}`;
  /** First pick of a two-click selection, until the second click. */
  readonly anchor = signal('');
  readonly from = computed(() => this.inputs()[0]?.value() ?? '');
  readonly to = computed(() => this.inputs()[1]?.value() ?? '');
  readonly orderError = computed(() => !!parseIso(this.from()) && !!parseIso(this.to()) && this.from() > this.to());
  readonly error = computed(() => this.inputs().map(i => i.parseError()).find(Boolean) || (this.orderError() ? DATE_ORDER_ERROR : ''));

  setRange(from: string, to: string): void {
    this.inputs()[0]?.setValue(from);
    this.inputs()[1]?.setValue(to);
  }

  /**
   * The first click only marks the anchor (shown selected); the second writes both ends at once, in date order.
   * Closing in between leaves the form untouched. Returns true when done.
   */
  pick(iso: string): boolean {
    const a = this.anchor();
    if (!a) {
      this.anchor.set(iso);
      return false;
    }
    this.anchor.set('');
    this.setRange(a <= iso ? a : iso, a <= iso ? iso : a);
    return true;
  }
}

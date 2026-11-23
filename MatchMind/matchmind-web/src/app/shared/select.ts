// Custom select (CUSTOM-1): a styled replacement for native <select>, built on @angular/cdk overlay + listbox.
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, booleanAttribute, computed, effect,
  forwardRef, inject, input, output, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CdkConnectedOverlay, ConnectedPosition } from '@angular/cdk/overlay';
import { CdkListbox, CdkOption } from '@angular/cdk/listbox';

export interface SelectOption { value: string; label: string; disabled?: boolean; }

let selectSeq = 0;

/** Below the trigger, flipped above when there is no room; start-aligned first, end-aligned near the right edge. */
const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * `<mm-select [options]="opts" formControlName="x" />` or `[(ngModel)]="x"`.
 * `selectionChange` (and the form value) change only on a pick (click, Enter, Space), never while arrowing (SET-1).
 *
 * The popup is a CDK popover inserted inline, right after the trigger. A popover sits in the top layer, so no
 * `overflow: hidden` ancestor clips it (DS-7), and being inside the trigger's subtree keeps it usable in a modal
 * `<dialog>` (mm-dialog): a body-level overlay would be inert behind `showModal()`.
 */
@Component({
  selector: 'mm-select',
  imports: [CdkConnectedOverlay, CdkListbox, CdkOption],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Select), multi: true }],
  // `id` / `aria-*` are forwarded to the trigger; a static attribute would otherwise duplicate them on the host.
  host: { '[attr.id]': 'null', '[attr.aria-label]': 'null', '[attr.aria-invalid]': 'null', '[attr.aria-describedby]': 'null', '[attr.autofocus]': 'null' },
  template: `
    <button #trigger type="button" role="combobox" class="input trigger" [class.input-sm]="size() === 'sm'"
      [id]="id()" [attr.aria-label]="ariaLabel()" aria-haspopup="listbox" [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? listId : null" [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy()" [attr.autofocus]="autofocus() || null" [disabled]="isDisabled()" [title]="selected()?.label ?? ''"
      (click)="toggle()" (keydown)="triggerKey($event)" (blur)="open() || onTouched()">
      <span class="value" [class.placeholder]="!selected()">{{ selected()?.label ?? placeholder() }}</span>
      <i class="pi pi-chevron-down chev" aria-hidden="true"></i>
    </button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="trigger" [cdkConnectedOverlayOpen]="open()"
      cdkConnectedOverlayUsePopover="inline" [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayMinWidth]="minWidth()" [cdkConnectedOverlayViewportMargin]="16"
      (overlayOutsideClick)="close(false)" (detach)="open.set(false)">
      <ul cdkListbox class="mm-select-list" [class.sm]="size() === 'sm'" [id]="listId" [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="ariaLabel() ? null : id()" [attr.aria-busy]="loading() || null"
        cdkListboxUseActiveDescendant cdkListboxNavigationWrapDisabled [cdkListboxValue]="listValue()"
        (cdkListboxValueChange)="pick($event.value[0])" (keydown)="listKey($event)">
        @if (loading()) {
          <li class="opt note" role="option" aria-disabled="true"><i class="pi pi-spinner pi-spin" aria-hidden="true"></i> Loading…</li>
        } @else {
          @for (o of options(); track o.value) {
            <li class="opt" [cdkOption]="o.value" [cdkOptionDisabled]="!!o.disabled" (click)="o.disabled || close(true)">
              <span class="label">{{ o.label }}</span>
              @if (o.value === value()) { <i class="pi pi-check" aria-hidden="true"></i> }
            </li>
          } @empty {
            <li class="opt note" role="option" aria-disabled="true">{{ emptyText() }}</li>
          }
        }
      </ul>
    </ng-template>`,
  styles: `
    :host { display: inline-block; max-width: 100%; min-width: 0; vertical-align: middle; }
    .trigger { display: flex; align-items: center; gap: var(--sp-2); width: 100%; text-align: start; cursor: pointer; }
    .value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .value.placeholder { color: var(--mm-ink-3); }
    .chev { flex: none; font-size: var(--fs-xs); color: var(--mm-ink-2); transition: transform var(--mm-t) var(--mm-ease); }
    .trigger[aria-expanded="true"] .chev { transform: rotate(180deg); }
    .mm-select-list {
      flex: 1; box-sizing: border-box; margin: 0; padding: var(--sp-1); list-style: none;
      max-width: max(100%, min(24rem, calc(100vw - 32px))); max-height: 320px; overflow-y: auto;
      background: var(--mm-card-solid); color: var(--mm-ink); border: 1px solid var(--mm-line-2);
      border-radius: var(--mm-radius); box-shadow: var(--mm-shadow-lg); font-size: var(--fs-sm);
      transform-origin: top; animation: mm-select-in 120ms var(--mm-ease);
    }
    .mm-select-list:focus { outline: none; }
    .opt { display: flex; align-items: center; gap: var(--sp-2); min-height: 2.25rem; padding: var(--sp-1) var(--sp-3); border-radius: 8px; cursor: pointer; }
    .mm-select-list.sm .opt { min-height: 2rem; }
    .label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .opt:hover, .opt.cdk-option-active { background: var(--mm-surface-3); }
    .mm-select-list:focus-visible .opt.cdk-option-active { box-shadow: inset 0 0 0 2px var(--mm-accent-ui); }
    .opt[aria-selected="true"] { background: var(--mm-green-soft); color: var(--mm-green-ink); font-weight: 600; }
    .opt[aria-disabled="true"] { color: var(--mm-ink-3); cursor: default; background: none; }
    .opt.note { font-style: italic; }
    @media (pointer: coarse) { .opt, .mm-select-list.sm .opt { min-height: 44px; } }
    @media (prefers-reduced-motion: reduce) { .mm-select-list { animation: none; } .chev { transition: none; } }
    @keyframes mm-select-in { from { opacity: 0; transform: scaleY(.96); } }
  `,
})
export class Select implements ControlValueAccessor {
  readonly options = input<SelectOption[]>([]);
  readonly placeholder = input('Select…');
  readonly size = input<'md' | 'sm'>('md');
  /** Goes on the trigger, so `<label for="...">` names it. */
  readonly id = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly invalid = input(false, { alias: 'aria-invalid', transform: booleanAttribute });
  readonly describedBy = input<string | null>(null, { alias: 'aria-describedby' });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  /** Native `<dialog>` focuses the first `[autofocus]` element on open: put it on the trigger, not the host. */
  readonly autofocus = input(false, { transform: booleanAttribute });
  readonly emptyText = input('No options');
  /** A user pick only; `writeValue` and arrow keys never emit. */
  readonly selectionChange = output<string>();

  readonly open = signal(false);
  readonly value = signal<string | null>(null);
  readonly listId = `mm-select-list-${++selectSeq}`;
  readonly positions = POSITIONS;
  readonly minWidth = signal(0);
  readonly selected = computed(() => this.options().find(o => o.value === this.value()) ?? null);
  /** Only values that exist in the list: CDK listbox throws on an unknown value in dev mode. */
  readonly listValue = computed(() => { const s = this.selected(); return s ? [s.value] : []; });
  private readonly cvaDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly listEl = viewChild(CdkListbox, { read: ElementRef<HTMLElement> });
  private readonly injector = inject(Injector);
  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    effect(() => { if (this.isDisabled()) this.open.set(false); });
  }

  toggle(): void {
    if (this.open()) this.close(false);
    else this.show();
  }

  show(): void {
    if (this.isDisabled() || this.open()) return;
    this.minWidth.set(this.trigger().nativeElement.getBoundingClientRect().width);
    this.open.set(true);
    // Focus the list and start on the selected option (scrolled into view), so arrows move from there.
    afterNextRender(() => {
      // cdkListbox itself makes the selected option active on init; only the scroll is ours.
      const el = this.listEl()?.nativeElement;
      el?.focus();
      el?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, { injector: this.injector });
  }

  close(refocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (refocus) this.trigger().nativeElement.focus();
  }

  pick(v: string | undefined): void {
    if (v === undefined || v === this.value()) return;
    this.value.set(v);
    this.onChange(v);
    this.selectionChange.emit(v);
  }

  /** Closed trigger: Down/Up/Alt+Down open the list (Enter/Space open it through the native click). */
  triggerKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.show(); }
  }

  /** Enter/Space are also handled by cdkListbox (it selects); here they close, even on the already-selected option. */
  listKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault(); // also keeps a surrounding modal <dialog> open
      e.stopPropagation();
      this.close(true);
    } else if (e.key === 'Enter' || e.key === ' ') {
      this.close(true);
    } else if (e.key === 'Tab') {
      this.close(false);
    }
  }

  /** null (reset, first ngModel write) maps to '' so an "All" option with value '' shows; with none, the placeholder does. */
  writeValue(v: string | null): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.cvaDisabled.set(d); }
}

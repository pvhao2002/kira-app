// MatchMind UI kit: small native-HTML building blocks (no component library).
import {
  ChangeDetectionStrategy, Component, Directive, ElementRef, Injectable, afterRenderEffect, computed, inject,
  input, model, output, signal, viewChild,
} from '@angular/core';

// ------------------------------------------------------------------ toasts
export interface Toast { id: number; severity: 'success' | 'info' | 'warn' | 'error'; summary: string; detail?: string; }

const TOAST_MS = 5000;

/**
 * Errors stay until dismissed; other toasts leave after 5 s, counting only while the stack is not hovered or focused
 * (WCAG 2.2.1). Nothing is dropped; an identical toast already on screen restarts its countdown instead of stacking.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;
  private paused = false;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  add(t: Omit<Toast, 'id'>): void {
    const same = this.toasts().find(x => x.severity === t.severity && x.summary === t.summary && x.detail === t.detail);
    const id = same?.id ?? ++this.seq;
    if (!same) this.toasts.update(list => [...list, { ...t, id }]);
    this.schedule(id, t.severity);
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update(list => list.filter(x => x.id !== id));
  }

  /** Hover / focus inside the stack: stop every countdown. */
  pause(): void {
    this.paused = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  /** Pointer and focus left: each remaining toast gets a fresh 5 s. */
  resume(): void {
    this.paused = false;
    for (const t of this.toasts()) this.schedule(t.id, t.severity);
  }

  private schedule(id: number, severity: Toast['severity']): void {
    clearTimeout(this.timers.get(id));
    if (this.paused || severity === 'error') return;
    this.timers.set(id, setTimeout(() => this.dismiss(id), TOAST_MS));
  }

  /** Copies text and reports the outcome; `what` names it in the toast ("JSON", "API key"). */
  copy(text: string, what: string): void {
    const fail = () => this.add({ severity: 'warn', summary: 'Copy failed', detail: `Select the ${what} and copy it manually.` });
    if (!navigator.clipboard) { fail(); return; }
    navigator.clipboard.writeText(text).then(
      () => this.add({ severity: 'success', summary: 'Copied', detail: `${what} copied to the clipboard.` }), fail);
  }
}

@Component({
  selector: 'mm-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" (mouseenter)="toast.pause()" (mouseleave)="toast.resume()"
      (focusin)="toast.pause()" (focusout)="focusOut($event)">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast toast-{{ t.severity }}" [attr.role]="t.severity === 'error' ? 'alert' : 'status'">
          <div><strong>{{ t.summary }}</strong>@if (t.detail) { <span>{{ t.detail }}</span> }</div>
          <button type="button" class="btn btn-text btn-icon" aria-label="Dismiss" (click)="toast.dismiss(t.id)"><i class="pi pi-times"></i></button>
        </div>
      }
    </div>`,
})
export class Toasts {
  readonly toast = inject(ToastService);

  focusOut(e: FocusEvent): void {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) this.toast.resume();
  }
}

// ------------------------------------------------------------------ dialog (native <dialog>: focus trap + Esc for free)
let dialogSeq = 0;

@Component({
  selector: 'mm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #d class="dialog" [style.width]="width()" [attr.aria-labelledby]="titleId" [attr.aria-busy]="busy() || null" (close)="onNativeClose()" (cancel)="onCancel($event)">
      <header class="dialog-head">
        <h2 [id]="titleId">{{ header() }}</h2>
        @if (closable()) { <button type="button" class="btn btn-text btn-icon" aria-label="Close" [disabled]="busy()" (click)="closed.emit()"><i class="pi pi-times"></i></button> }
      </header>
      @if (open()) { <fieldset class="dialog-body" [disabled]="busy()"><ng-content /></fieldset> }
    </dialog>`,
})
export class Dialog {
  readonly open = input(false);
  readonly header = input('');
  readonly width = input('min(520px, 95vw)');
  readonly closable = input(true);
  /**
   * The page's submit is in flight: every control in the body is disabled (native `<fieldset disabled>`), and the
   * dialog cannot be closed until it ends, so a double click or Enter cannot send the request twice.
   */
  readonly busy = input(false);
  readonly closed = output<void>();
  readonly titleId = `mm-dialog-${++dialogSeq}`;
  private readonly el = viewChild.required<ElementRef<HTMLDialogElement>>('d');

  constructor() {
    afterRenderEffect(() => {
      const d = this.el().nativeElement;
      if (this.open() && !d.open) d.showModal?.();
      else if (!this.open() && d.open) d.close?.();
    });
  }

  /** Esc. A statement, not an expression: a listener returning `false` makes Angular prevent the default (UX-120). */
  onCancel(e: Event): void {
    if (!this.closable() || this.busy()) e.preventDefault();
  }

  /** Esc (native cancel → close) while the parent still thinks it is open. */
  onNativeClose(): void {
    if (!this.open()) return;
    // Chrome closes a modal on a second Esc even when cancel is prevented; a non-closable dialog must stay up.
    if (!this.closable() || this.busy()) this.el().nativeElement.showModal?.();
    else this.closed.emit();
  }
}

// ------------------------------------------------------------------ confirm (one host in the app shell)
export interface ConfirmRequest { header: string; message: string; acceptLabel: string; danger?: boolean; }

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<(ConfirmRequest & { resolve: (ok: boolean) => void }) | null>(null);

  ask(r: ConfirmRequest): Promise<boolean> {
    this.current()?.resolve(false);
    return new Promise(resolve => this.current.set({ ...r, resolve }));
  }

  answer(ok: boolean): void {
    this.current()?.resolve(ok);
    this.current.set(null);
  }
}

@Component({
  selector: 'mm-confirm',
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mm-dialog [open]="!!c.current()" [header]="c.current()?.header ?? ''" width="min(440px, 95vw)" (closed)="c.answer(false)">
      <p>{{ c.current()?.message }}</p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-text" (click)="c.answer(false)">Cancel</button>
        <button type="button" class="btn" [class.btn-danger]="c.current()?.danger" [class.btn-primary]="!c.current()?.danger" (click)="c.answer(true)">{{ c.current()?.acceptLabel }}</button>
      </div>
    </mm-dialog>`,
})
export class ConfirmHost {
  readonly c = inject(ConfirmService);
}

// ------------------------------------------------------------------ tables: sort header, paginator, resize, expansion
export type Sort = { field: string; dir: 'asc' | 'desc' } | null;

/** `<th mmSort="field" [sort]="sort()" (sortChange)="...">Label</th>`: click toggles desc → asc. */
@Component({
  selector: 'th[mmSort]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.aria-sort]': 'aria()' },
  template: `<button type="button" class="sort-btn" (click)="toggle()"><ng-content /><i [class]="icon()" aria-hidden="true"></i></button>`,
})
export class SortHeader {
  readonly mmSort = input.required<string>();
  readonly sort = model<Sort>(null);
  readonly active = computed(() => this.sort()?.field === this.mmSort());
  readonly icon = computed(() => !this.active() ? 'pi pi-sort-alt sort-idle' : this.sort()!.dir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down');
  readonly aria = computed(() => !this.active() ? 'none' : this.sort()!.dir === 'asc' ? 'ascending' : 'descending');

  toggle(): void {
    const desc = !this.active() || this.sort()!.dir === 'asc';
    this.sort.set({ field: this.mmSort(), dir: desc ? 'desc' : 'asc' });
  }
}

/** In-memory sort for small, already-aggregated tables (nulls last). */
export function sortRows<T>(rows: T[], sort: Sort): T[] {
  if (!sort) return rows;
  const k = sort.field as keyof T;
  const m = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[k] as unknown, y = b[k] as unknown;
    if (x === y || (x == null && y == null)) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * m;
  });
}

export function sortParam(sort: Sort): string | undefined {
  return sort ? `${sort.field},${sort.dir}` : undefined;
}

@Component({
  selector: 'mm-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="paginator" aria-label="Pagination">
      <span class="muted-text" role="status">{{ first() }}–{{ last() }} of {{ total() }}{{ unit() ? ' ' + unit() : '' }}</span>
      <span class="row">
        <button type="button" class="btn btn-text btn-icon" aria-label="First page" [disabled]="page() === 0" (click)="go(0)"><i class="pi pi-angle-double-left"></i></button>
        <button type="button" class="btn btn-text btn-icon" aria-label="Previous page" [disabled]="page() === 0" (click)="go(page() - 1)"><i class="pi pi-angle-left"></i></button>
        <span>Page {{ page() + 1 }} of {{ pages() }}</span>
        <button type="button" class="btn btn-text btn-icon" aria-label="Next page" [disabled]="page() >= pages() - 1" (click)="go(page() + 1)"><i class="pi pi-angle-right"></i></button>
        <button type="button" class="btn btn-text btn-icon" aria-label="Last page" [disabled]="page() >= pages() - 1" (click)="go(pages() - 1)"><i class="pi pi-angle-double-right"></i></button>
        @if (sizes().length > 1) {
          <select class="input input-sm" aria-label="Rows per page" [value]="size()" (change)="resize($event)">
            @for (s of sizes(); track s) { <option [value]="s" [selected]="s === size()">{{ s }} / page</option> }
          </select>
        }
      </span>
    </nav>`,
})
export class Paginator {
  readonly page = input(0);
  readonly size = input(25);
  readonly total = input(0);
  readonly sizes = input<number[]>([25, 50, 100]);
  readonly unit = input('');
  /** Not `change`: the `<select>`'s DOM change event bubbles to the host and would reach the same listener (UX-080). */
  readonly pageChange = output<{ page: number; size: number }>();
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly first = computed(() => this.total() === 0 ? 0 : this.page() * this.size() + 1);
  readonly last = computed(() => Math.min(this.total(), (this.page() + 1) * this.size()));

  go(p: number): void { this.pageChange.emit({ page: p, size: this.size() }); }
  resize(e: Event): void { this.pageChange.emit({ page: 0, size: Number((e.target as HTMLSelectElement).value) }); }
}

/** Drag handle on the right edge of a header cell; also a focusable separator: Left/Right resize (Shift: 64px). */
@Directive({ selector: 'th[mmResize]', host: { class: 'resizable' } })
export class ResizableColumn {
  constructor() {
    const th = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const handle = document.createElement('span');
    handle.className = 'col-resizer';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.tabIndex = 0;
    th.appendChild(handle);
    const setWidth = (px: number) => { const w = `${Math.max(48, Math.round(px))}px`; th.style.width = w; th.style.minWidth = w; };
    // The header text is projected after construction: name the handle once it is there.
    queueMicrotask(() => handle.setAttribute('aria-label', `Resize column ${th.textContent?.trim() ?? ''}`.trim()));
    handle.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const step = (e.shiftKey ? 64 : 16) * (e.key === 'ArrowRight' ? 1 : -1);
      setWidth((th.offsetWidth || parseFloat(th.style.width) || 0) + step);
    });
    handle.addEventListener('pointerdown', down => {
      down.preventDefault();
      down.stopPropagation();
      const startX = down.clientX, startW = th.offsetWidth;
      handle.setPointerCapture?.(down.pointerId);
      const move = (e: PointerEvent) => setWidth(startW + e.clientX - startX);
      const up = () => {
        handle.removeEventListener('pointermove', move);
        for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.removeEventListener(t, up);
      };
      handle.addEventListener('pointermove', move);
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(t, up);
    });
  }
}

/** Expanded-row bookkeeping for tables. */
export class Expansion {
  private readonly ids = signal(new Set<string>());
  has(id: string): boolean { return this.ids().has(id); }
  toggle(id: string): void {
    this.ids.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  clear(): void { this.ids.set(new Set()); }
}

// ------------------------------------------------------------------ tabs
@Component({
  selector: 'mm-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" (keydown)="key($event)">
      @for (t of tabs(); track t.value) {
        <button type="button" role="tab" class="tab" [id]="'tab-' + t.value" [class.active]="t.value === value()" [attr.aria-selected]="t.value === value()"
          [attr.aria-controls]="t.value === value() ? controls() : null"
          [attr.tabindex]="t.value === value() ? 0 : -1" (click)="value.set(t.value)">{{ t.label }}</button>
      }
    </div>`,
})
export class Tabs {
  readonly tabs = input.required<{ value: string; label: string }[]>();
  readonly value = model.required<string>();
  /** Id of the page's `role="tabpanel"` element; set on the selected tab as `aria-controls`. */
  readonly controls = input<string | null>(null);

  /**
   * APG tabs with manual activation: arrows, Home and End move focus; Enter/Space (a click) selects. Reports load a
   * query per tab, so automatic activation would fire one request per key press (UX-125).
   */
  key(e: KeyboardEvent): void {
    const buttons = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')];
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const n = buttons.length;
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1
      : e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : -1;
    if (target < 0 || !n) return;
    e.preventDefault();
    buttons[target].focus();
  }
}

// MatchMind UI kit: small native-HTML building blocks (no component library).
import {
  ChangeDetectionStrategy, Component, Directive, ElementRef, Injectable, afterRenderEffect, computed, inject,
  input, model, output, signal, viewChild,
} from '@angular/core';

// ------------------------------------------------------------------ toasts
export interface Toast { id: number; severity: 'success' | 'info' | 'warn' | 'error'; summary: string; detail?: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  add(t: Omit<Toast, 'id'>): void {
    const id = ++this.seq;
    this.toasts.update(list => [...list.slice(-3), { ...t, id }]);
    setTimeout(() => this.dismiss(id), t.severity === 'error' ? 8000 : 5000);
  }

  dismiss(id: number): void { this.toasts.update(list => list.filter(x => x.id !== id)); }

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
    <div class="toasts" aria-live="polite">
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
}

// ------------------------------------------------------------------ dialog (native <dialog>: focus trap + Esc for free)
let dialogSeq = 0;

@Component({
  selector: 'mm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #d class="dialog" [style.width]="width()" [attr.aria-labelledby]="titleId" (close)="onNativeClose()" (cancel)="!closable() && $event.preventDefault()">
      <header class="dialog-head">
        <h2 [id]="titleId">{{ header() }}</h2>
        @if (closable()) { <button type="button" class="btn btn-text btn-icon" aria-label="Close" (click)="closed.emit()"><i class="pi pi-times"></i></button> }
      </header>
      @if (open()) { <div class="dialog-body"><ng-content /></div> }
    </dialog>`,
})
export class Dialog {
  readonly open = input(false);
  readonly header = input('');
  readonly width = input('min(520px, 95vw)');
  readonly closable = input(true);
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

  /** Esc (native cancel → close) while the parent still thinks it is open. */
  onNativeClose(): void {
    if (!this.open()) return;
    // Chrome closes a modal on a second Esc even when cancel is prevented; a non-closable dialog must stay up.
    if (!this.closable()) this.el().nativeElement.showModal?.();
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
      <span class="muted-text">{{ first() }}–{{ last() }} of {{ total() }}{{ unit() ? ' ' + unit() : '' }}</span>
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
  readonly change = output<{ page: number; size: number }>();
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly first = computed(() => this.total() === 0 ? 0 : this.page() * this.size() + 1);
  readonly last = computed(() => Math.min(this.total(), (this.page() + 1) * this.size()));

  go(p: number): void { this.change.emit({ page: p, size: this.size() }); }
  resize(e: Event): void { this.change.emit({ page: 0, size: Number((e.target as HTMLSelectElement).value) }); }
}

/** Drag handle on the right edge of a header cell. */
@Directive({ selector: 'th[mmResize]', host: { class: 'resizable' } })
export class ResizableColumn {
  constructor() {
    const th = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const handle = document.createElement('span');
    handle.className = 'col-resizer';
    handle.setAttribute('aria-hidden', 'true');
    th.appendChild(handle);
    handle.addEventListener('pointerdown', down => {
      down.preventDefault();
      down.stopPropagation();
      const startX = down.clientX, startW = th.offsetWidth;
      handle.setPointerCapture?.(down.pointerId);
      const move = (e: PointerEvent) => { const w = `${Math.max(48, startW + e.clientX - startX)}px`; th.style.width = w; th.style.minWidth = w; };
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
          [attr.tabindex]="t.value === value() ? 0 : -1" (click)="value.set(t.value)">{{ t.label }}</button>
      }
    </div>`,
})
export class Tabs {
  readonly tabs = input.required<{ value: string; label: string }[]>();
  readonly value = model.required<string>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  key(e: KeyboardEvent): void {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const list = this.tabs();
    const i = list.findIndex(t => t.value === this.value());
    const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
    this.value.set(next.value);
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>(`#tab-${next.value}`)?.focus());
  }
}

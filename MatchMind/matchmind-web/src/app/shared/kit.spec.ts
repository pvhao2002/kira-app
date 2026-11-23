import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, Paginator, ResizableColumn, Tabs, ToastService } from './kit';
import { DetailsMenu, JsonView, ScoreChip, StateView } from './ui';

const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

@Component({
  imports: [Paginator],
  template: `<mm-paginator [page]="0" [size]="25" [total]="130" unit="matches" (pageChange)="events.push($event)" />`,
})
class PaginatorHost { readonly events: unknown[] = []; }

describe('mm-paginator', () => {
  it('emits one {page, size} with a number when a "Rows per page" option is picked (UX-080)', async () => {
    Element.prototype.scrollIntoView ??= () => {};   // jsdom lacks it; cdkOption calls it
    const f = TestBed.createComponent(PaginatorHost);
    document.body.appendChild(f.nativeElement);
    await f.whenStable();
    const trigger = f.nativeElement.querySelector('button[aria-label="Rows per page"]') as HTMLButtonElement;
    expect(trigger.textContent).toContain('25 / page');
    trigger.click();
    await f.whenStable();
    const option = [...document.querySelectorAll('[role="option"]')].find(o => text(o).startsWith('50')) as HTMLElement;
    option.click();
    await f.whenStable();
    expect(f.componentInstance.events).toEqual([{ page: 0, size: 50 }]);
    document.body.innerHTML = '';
  });

  it('announces the result count politely (UX-102)', async () => {
    const f = TestBed.createComponent(PaginatorHost);
    await f.whenStable();
    const status = f.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(text(status)).toBe('1–25 of 130 matches');
  });
});

@Component({
  imports: [Dialog],
  template: `<mm-dialog [open]="true" header="Add user" [closable]="closable()" [busy]="busy()" (closed)="closed = closed + 1">
    <button type="submit">Save</button></mm-dialog>`,
})
class DialogHost { readonly closable = signal(true); readonly busy = signal(false); closed = 0; }

const cancel = (f: { nativeElement: HTMLElement }) => {
  const e = new Event('cancel', { cancelable: true });
  f.nativeElement.querySelector('dialog')!.dispatchEvent(e);
  return e;
};

describe('mm-dialog', () => {
  it('Esc is one close request, like the X: the native dialog never closes on its own, so the page can veto (UX-083, UX-120)', async () => {
    const f = TestBed.createComponent(DialogHost);
    await f.whenStable();
    expect(cancel(f).defaultPrevented).toBe(true);
    expect(f.componentInstance.closed).toBe(1);
  });

  it('blocks Esc on a non-closable dialog and does not ask the page to close', async () => {
    const f = TestBed.createComponent(DialogHost);
    f.componentInstance.closable.set(false);
    await f.whenStable();
    expect(cancel(f).defaultPrevented).toBe(true);
    expect(f.componentInstance.closed).toBe(0);
  });

  it('a native close the page has not accepted (second Esc in Chrome) re-shows the dialog and asks again', async () => {
    const f = TestBed.createComponent(DialogHost);
    await f.whenStable();
    const d = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const show = vi.fn();
    d.showModal = show;
    d.dispatchEvent(new Event('close'));
    expect(show).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.closed).toBe(1);
    f.componentInstance.busy.set(true);
    await f.whenStable();
    d.dispatchEvent(new Event('close'));
    expect(show).toHaveBeenCalledTimes(2);
    expect(f.componentInstance.closed).toBe(1);   // busy: re-shown, no close request
  });

  it('busy disables the content and the close paths so a double click cannot submit twice (UX-109)', async () => {
    const f = TestBed.createComponent(DialogHost);
    f.componentInstance.busy.set(true);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect((el.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect((el.querySelector('button[aria-label="Close"]') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('dialog')!.getAttribute('aria-busy')).toBe('true');
    expect(cancel(f).defaultPrevented).toBe(true);
  });
});

@Component({
  imports: [Tabs],
  template: `<mm-tabs [tabs]="tabs" [(value)]="value" controls="panel" /><div id="panel" role="tabpanel"></div>`,
})
class TabsHost {
  readonly tabs = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }];
  readonly value = signal('a');
}

describe('mm-tabs', () => {
  const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  it('arrows and Home/End move focus only; activation is manual (UX-125)', async () => {
    const f = TestBed.createComponent(TabsHost);
    await f.whenStable();
    const tabs = [...f.nativeElement.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
    tabs[0].focus();
    key(tabs[0], 'End');
    expect(document.activeElement).toBe(tabs[2]);
    key(tabs[2], 'Home');
    expect(document.activeElement).toBe(tabs[0]);
    key(tabs[0], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[1]);
    key(tabs[1], 'ArrowLeft');
    key(tabs[0], 'ArrowLeft');
    expect(document.activeElement).toBe(tabs[2]);
    expect(f.componentInstance.value()).toBe('a');
    tabs[2].click();
    expect(f.componentInstance.value()).toBe('c');
  });

  it('the selected tab points at its panel (UX-040)', async () => {
    const f = TestBed.createComponent(TabsHost);
    await f.whenStable();
    const tabs = [...f.nativeElement.querySelectorAll('[role="tab"]')] as HTMLElement[];
    expect(tabs[0].getAttribute('aria-controls')).toBe('panel');
    expect(tabs[1].hasAttribute('aria-controls')).toBe(false);
  });
});

describe('ToastService (UX-115)', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps errors until dismissed and auto-dismisses the rest', () => {
    vi.useFakeTimers();
    const t = TestBed.inject(ToastService);
    t.add({ severity: 'error', summary: 'Server error' });
    t.add({ severity: 'success', summary: 'Saved' });
    vi.advanceTimersByTime(60_000);
    expect(t.toasts().map(x => x.summary)).toEqual(['Server error']);
  });

  it('pauses the countdown while the toasts are hovered or focused', () => {
    vi.useFakeTimers();
    const t = TestBed.inject(ToastService);
    t.add({ severity: 'info', summary: 'Hi' });
    t.pause();
    vi.advanceTimersByTime(60_000);
    expect(t.toasts().length).toBe(1);
    t.resume();
    vi.advanceTimersByTime(5_000);
    expect(t.toasts().length).toBe(0);
  });

  it('does not drop older toasts and merges identical ones', () => {
    const t = TestBed.inject(ToastService);
    for (let i = 0; i < 6; i++) t.add({ severity: 'error', summary: `E${i}` });
    t.add({ severity: 'error', summary: 'E0' });
    expect(t.toasts().map(x => x.summary)).toEqual(['E0', 'E1', 'E2', 'E3', 'E4', 'E5']);
  });
});

@Component({
  imports: [ResizableColumn],
  template: `<table><thead><tr><th mmResize style="width: 100px">Win rate</th></tr></thead></table>`,
})
class ResizeHost {}

describe('column resize (UX-102)', () => {
  it('the handle is a keyboard-operable separator', async () => {
    const f = TestBed.createComponent(ResizeHost);
    await f.whenStable();
    const handle = f.nativeElement.querySelector('.col-resizer') as HTMLElement;
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-label')).toBe('Resize column Win rate');
    expect(handle.hasAttribute('aria-hidden')).toBe(false);
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const th = f.nativeElement.querySelector('th') as HTMLElement;
    expect(parseInt(th.style.width)).toBeGreaterThan(parseInt(th.style.minWidth || '0') - 1);
    expect(th.style.width).not.toBe('100px');
  });
});

describe('shared/ui', () => {
  it('a missing score is one dash, not "—:—" (UX-070)', async () => {
    const f = TestBed.createComponent(ScoreChip);
    await f.whenStable();
    expect(text(f.nativeElement)).toBe('—');
  });

  it('raw JSON shows hidden BiDi controls as escapes (UX-030)', async () => {
    const f = TestBed.createComponent(JsonView);
    f.componentRef.setInput('value', { home: 'abc‮def' });
    await f.whenStable();
    const pre = text(f.nativeElement.querySelector('pre'));
    expect(pre).toContain('abc\\u202e');
    expect(pre).not.toContain('‮');
  });
});

@Component({
  imports: [StateView],
  template: `<mm-state [state]="state()" message="Boom" [retryable]="retryable()" (retry)="retries = retries + 1" />`,
})
class StateHost { readonly state = signal<'loading' | 'error'>('loading'); readonly retryable = signal(false); retries = 0; }

describe('mm-state', () => {
  it('announces loading as a status with text, not an unnamed div (DS-11)', async () => {
    const f = TestBed.createComponent(StateHost);
    await f.whenStable();
    const status = f.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(text(status)).toBe('Loading…');
    expect(status.hasAttribute('aria-label')).toBe(false);
  });

  it('error: Retry only when asked for, and it emits retry once', async () => {
    const f = TestBed.createComponent(StateHost);
    f.componentInstance.state.set('error');
    await f.whenStable();
    expect(f.nativeElement.querySelector('[data-testid="state-retry"]')).toBeNull();
    expect(f.nativeElement.querySelector('.state-box i')!.getAttribute('aria-hidden')).toBe('true');
    f.componentInstance.retryable.set(true);
    await f.whenStable();
    (f.nativeElement.querySelector('[data-testid="state-retry"]') as HTMLButtonElement).click();
    expect(f.componentInstance.retries).toBe(1);
  });
});

@Component({
  imports: [DetailsMenu],
  template: `<details class="menu" open><summary>Columns</summary><div class="menu-body"><input type="checkbox"></div></details><button id="away">x</button>`,
})
class MenuHost {}

describe('details.menu close behaviour (DS-7)', () => {
  it('Esc closes it and returns focus to the summary; an outside click closes it; an inside click does not', async () => {
    const f = TestBed.createComponent(MenuHost);
    document.body.appendChild(f.nativeElement);
    await f.whenStable();
    const d = f.nativeElement.querySelector('details') as HTMLDetailsElement;
    (f.nativeElement.querySelector('input') as HTMLElement).click();
    expect(d.open).toBe(true);
    (f.nativeElement.querySelector('input') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(d.open).toBe(false);
    expect(document.activeElement).toBe(d.querySelector('summary'));
    d.open = true;
    (f.nativeElement.querySelector('#away') as HTMLElement).click();
    expect(d.open).toBe(false);
    f.nativeElement.remove();
  });
});

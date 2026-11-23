import { Component, Type, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Dialog } from './kit';
import { Select, SelectOption } from './select';

const OPTS: SelectOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
];

// CDK key managers read the legacy `keyCode`, so set both.
const CODES: Record<string, number> = { Enter: 13, Escape: 27, ' ': 32, ArrowUp: 38, ArrowDown: 40, Tab: 9 };
const keydown = (k: string) => new KeyboardEvent('keydown', { key: k, keyCode: CODES[k], bubbles: true, cancelable: true });
const key = (el: Element, k: string) => el.dispatchEvent(keydown(k));

@Component({
  imports: [Select, ReactiveFormsModule],
  template: `<label for="sel">Kind</label>
    <mm-select id="sel" [options]="opts()" [loading]="loading()" emptyText="Nothing here" [aria-invalid]="bad()" [formControl]="ctrl" (selectionChange)="picks.push($event)" />`,
})
class ReactiveHost {
  readonly opts = signal(OPTS);
  readonly loading = signal(false);
  readonly bad = signal(false);
  readonly ctrl = new FormControl<string | null>('a');
  readonly picks: string[] = [];
}

@Component({
  imports: [Select, FormsModule],
  template: `<mm-select ariaLabel="Status" autofocus [options]="opts" [(ngModel)]="v" />`,
})
class NgModelHost { readonly opts = OPTS; v: string | null = 'c'; }

async function setup<T>(type: Type<T>) {
  const f = TestBed.createComponent(type);
  document.body.appendChild(f.nativeElement);
  await f.whenStable();
  const trigger = () => f.nativeElement.querySelector('button[role="combobox"]') as HTMLButtonElement;
  const list = () => document.querySelector('[role="listbox"]') as HTMLElement | null;
  const options = () => [...document.querySelectorAll('[role="option"]')] as HTMLElement[];
  return { f, trigger, list, options };
}

// jsdom has no scrollIntoView; cdkOption calls it on the active option.
beforeAll(() => { Element.prototype.scrollIntoView ??= () => {}; });

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('mm-select', () => {
  it('reads and writes a reactive form control, and puts the id on the trigger only', async () => {
    const { f, trigger } = await setup(ReactiveHost);
    expect(trigger().textContent).toContain('Alpha');
    expect(trigger().id).toBe('sel');
    expect(f.nativeElement.querySelectorAll('#sel').length).toBe(1);
    f.componentInstance.ctrl.setValue('c');
    await f.whenStable();
    expect(trigger().textContent).toContain('Gamma');
    expect(trigger().title).toBe('Gamma');
    expect(f.componentInstance.picks).toEqual([]); // writeValue never emits
  });

  it('works with ngModel', async () => {
    const { f, trigger, options } = await setup(NgModelHost);
    await f.whenStable();
    expect(trigger().textContent).toContain('Gamma');
    expect(trigger().getAttribute('aria-label')).toBe('Status');
    expect(trigger().hasAttribute('autofocus')).toBe(true); // a native <dialog> focuses it on open
    expect(f.nativeElement.querySelector('mm-select').hasAttribute('autofocus')).toBe(false);
    trigger().click();
    await f.whenStable();
    options()[0].click();
    await f.whenStable();
    expect(f.componentInstance.v).toBe('a');
  });

  it('opens from the keyboard; arrows move without emitting; Enter picks, closes and refocuses the trigger', async () => {
    const { f, trigger, list } = await setup(ReactiveHost);
    key(trigger(), 'ArrowDown');
    await f.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(list()!.id);
    expect(document.activeElement).toBe(list());

    key(list()!, 'ArrowDown'); // Alpha -> Gamma (Beta is disabled and skipped)
    await f.whenStable();
    expect(list()!.getAttribute('aria-activedescendant')).toBe(document.querySelectorAll('[role="option"]')[2].id);
    expect(f.componentInstance.picks).toEqual([]);
    expect(f.componentInstance.ctrl.value).toBe('a');

    key(list()!, 'Enter');
    await f.whenStable();
    expect(f.componentInstance.picks).toEqual(['c']);
    expect(f.componentInstance.ctrl.value).toBe('c');
    expect(list()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('Esc closes without picking, restores focus and is not passed on to a surrounding dialog', async () => {
    const { f, trigger, list } = await setup(ReactiveHost);
    trigger().click();
    await f.whenStable();
    key(list()!, 'ArrowDown');
    const esc = keydown('Escape');
    list()!.dispatchEvent(esc);
    await f.whenStable();
    expect(esc.defaultPrevented).toBe(true);
    expect(list()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(f.componentInstance.picks).toEqual([]);
    expect(f.componentInstance.ctrl.touched).toBe(true);
  });

  it('Tab closes the list without picking; aria-invalid goes on the trigger, not the host', async () => {
    const { f, trigger, list } = await setup(ReactiveHost);
    f.componentInstance.bad.set(true);
    trigger().click();
    await f.whenStable();
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('mm-select').hasAttribute('aria-invalid')).toBe(false);
    key(list()!, 'ArrowDown');
    key(list()!, 'Tab');
    await f.whenStable();
    expect(list()).toBeNull();
    expect(f.componentInstance.ctrl.value).toBe('a');
  });

  it('opens with the selected option active, so arrows move from there', async () => {
    const { f, trigger, list, options } = await setup(NgModelHost); // v = 'c'
    trigger().click();
    await f.whenStable();
    expect(list()!.getAttribute('aria-activedescendant')).toBe(options()[2].id);
  });

  it('reset (null) shows the "" option label; a value written before options arrive shows once they do', async () => {
    const { f, trigger } = await setup(ReactiveHost);
    f.componentInstance.opts.set([{ value: '', label: 'All statuses' }, ...OPTS]);
    f.componentInstance.ctrl.reset();
    await f.whenStable();
    expect(trigger().textContent).toContain('All statuses');

    f.componentInstance.opts.set([]);
    f.componentInstance.ctrl.setValue('c');
    await f.whenStable();
    expect(trigger().textContent).toContain('Select…');
    f.componentInstance.opts.set(OPTS);
    await f.whenStable();
    expect(trigger().textContent).toContain('Gamma');
  });

  it('does not pick a disabled option', async () => {
    const { f, trigger, options } = await setup(ReactiveHost);
    trigger().click();
    await f.whenStable();
    expect(options()[1].getAttribute('aria-disabled')).toBe('true');
    options()[1].click();
    await f.whenStable();
    expect(f.componentInstance.ctrl.value).toBe('a');
    expect(f.componentInstance.picks).toEqual([]);
  });

  it('a disabled control cannot open', async () => {
    const { f, trigger, list } = await setup(ReactiveHost);
    f.componentInstance.ctrl.disable();
    await f.whenStable();
    expect(trigger().disabled).toBe(true);
    key(trigger(), 'ArrowDown');
    await f.whenStable();
    expect(list()).toBeNull();
  });

  it('shows a disabled message row when empty and a spinner row while loading', async () => {
    const { f, trigger, options, list } = await setup(ReactiveHost);
    f.componentInstance.opts.set([]);
    await f.whenStable();
    expect(trigger().textContent).toContain('Select…'); // value 'a' no longer in the list: placeholder, no throw
    trigger().click();
    await f.whenStable();
    expect(options().map(o => [o.textContent?.trim(), o.getAttribute('aria-disabled')])).toEqual([['Nothing here', 'true']]);

    f.componentInstance.loading.set(true);
    await f.whenStable();
    expect(list()!.getAttribute('aria-busy')).toBe('true');
    expect(options()[0].textContent).toContain('Loading');
  });
});

@Component({
  imports: [Dialog, Select, FormsModule],
  template: `<mm-dialog [open]="true" header="Pick"><mm-select ariaLabel="Model" [options]="opts" [(ngModel)]="v" /></mm-dialog>`,
})
class DialogHost { readonly opts = OPTS; v = 'a'; }

describe('mm-select inside a modal mm-dialog', () => {
  it('renders the popup as a popover inside the dialog subtree, so showModal() does not make it inert', async () => {
    // jsdom has no Popover API; with it, CDK renders the overlay as a top-layer popover.
    const show = vi.fn();
    const saved = [Object.getOwnPropertyDescriptors(HTMLElement.prototype), Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype)] as const;
    Object.assign(HTMLElement.prototype, { showPopover: show, hidePopover: () => {} });
    Object.assign(HTMLDialogElement.prototype, { showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    try {
      const { f, trigger, list } = await setup(DialogHost);
      trigger().click();
      await f.whenStable();
      const dialog = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
      const host = list()!.closest('[popover]') as HTMLElement;
      expect(host).not.toBeNull();
      expect(dialog.contains(host)).toBe(true);
      expect(show).toHaveBeenCalled();
    } finally {
      for (const [proto, d] of [[HTMLElement.prototype, saved[0]], [HTMLDialogElement.prototype, saved[1]]] as const) {
        for (const k of ['showPopover', 'hidePopover', 'showModal']) {
          if (k in d) Object.defineProperty(proto, k, d[k as keyof typeof d]);
          else delete (proto as unknown as Record<string, unknown>)[k];
        }
      }
    }
  });
});

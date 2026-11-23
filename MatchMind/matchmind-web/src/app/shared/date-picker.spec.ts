import { Component, Type, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { afterEach, describe, expect, it } from 'vitest';
import { DATE_ORDER_ERROR, DateInput, DateRange, addMonths, moveKey, parseTyped, presetRange, toIso } from './date-picker';

@Component({
  imports: [ReactiveFormsModule, DateInput],
  template: `<form [formGroup]="form"><mm-date-input formControlName="day" ariaLabel="Day" /></form>`,
})
class FormHost {
  readonly form = new FormGroup({ day: new FormControl('') });
}

@Component({
  imports: [FormsModule, DateInput, DateRange],
  template: `
    <mm-date-range label="Kick-off">
      <mm-date-input [(ngModel)]="from" [min]="min()" [max]="fromMax()" />
      <mm-date-input [(ngModel)]="to" [min]="toMin()" [max]="max()" />
    </mm-date-range>`,
})
class RangeHost {
  readonly from = signal('');
  readonly to = signal('');
  readonly min = signal('');
  readonly max = signal('');
  readonly fromMax = signal('');
  readonly toMin = signal('');
}

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const key = (el: Element, k: string, shiftKey = false) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }));

async function mount<T>(type: Type<T>) {
  const fixture = TestBed.createComponent(type);
  await fixture.whenStable();
  const settle = () => fixture.whenStable();
  return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, settle };
}

async function type(input: HTMLInputElement, text: string, settle: () => Promise<void>) {
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
  await settle();
}

describe('date helpers', () => {
  it('parses typed dd/mm/yyyy and ISO, rejects impossible days', () => {
    expect(parseTyped('1/2/2026')).toBe('2026-02-01');
    expect(parseTyped('23.11.2026')).toBe('2026-11-23');
    expect(parseTyped('2026-11-23')).toBe('2026-11-23');
    expect(parseTyped('  ')).toBe('');
    expect(parseTyped('31/02/2026')).toBeNull();
    expect(parseTyped('next week')).toBeNull();
  });

  it('moves by grid keys with a Monday week start and month-end clamping', () => {
    expect(moveKey('2026-11-25', 'Home')).toBe('2026-11-23');        // Wednesday -> Monday
    expect(moveKey('2026-11-25', 'End')).toBe('2026-11-29');         // -> Sunday
    expect(moveKey('2026-03-31', 'PageUp')).toBe('2026-02-28');
    expect(moveKey('2026-11-25', 'PageDown', true)).toBe('2027-11-25');
    expect(moveKey('2026-11-25', 'ArrowUp')).toBe('2026-11-18');
    expect(moveKey('2026-11-25', 'x')).toBeNull();
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  });

  it('builds presets from local days; "Last 7 days" includes today', () => {
    const now = new Date(2026, 2, 3, 0, 30);
    expect(presetRange('last7', now)).toEqual(['2026-02-25', '2026-03-03']);
    expect(presetRange('last30', now)).toEqual(['2026-02-02', '2026-03-03']);
    expect(presetRange('today', now)).toEqual(['2026-03-03', '2026-03-03']);
    expect(presetRange('month', now)).toEqual(['2026-03-01', '2026-03-31']);
  });

  describe('in UTC+7', () => {
    // Node re-reads TZ when it is assigned; there are no Node types in this project, hence the cast.
    const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
    const tz = env['TZ'];
    afterEach(() => { if (tz === undefined) delete env['TZ']; else env['TZ'] = tz; });   // assigning undefined would set "undefined"

    it('keeps the local day just after midnight (no UTC shift)', () => {
      env['TZ'] = 'Asia/Ho_Chi_Minh';
      const justAfterMidnight = new Date(2026, 2, 1, 0, 30);
      expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-02-28');   // what toISOString would have stored
      expect(toIso(justAfterMidnight)).toBe('2026-03-01');
      expect(presetRange('today', justAfterMidnight)).toEqual(['2026-03-01', '2026-03-01']);
    });
  });
});

describe('mm-date-input', () => {
  it('round-trips a YYYY-MM-DD form value and shows it as dd/mm/yyyy', async () => {
    const { host, el, settle } = await mount(FormHost);
    host.form.controls.day.setValue('2026-11-23');
    await settle();
    const input = el.querySelector('input')!;
    expect(input.value).toBe('23/11/2026');

    await type(input, '1/2/2026', settle);
    expect(host.form.controls.day.value).toBe('2026-02-01');
    expect(input.value).toBe('01/02/2026');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('marks invalid typed text and empties the value', async () => {
    const { host, el, settle } = await mount(FormHost);
    host.form.controls.day.setValue('2026-11-23');
    await settle();
    const input = el.querySelector('input')!;
    await type(input, '31/02/2026', settle);
    expect(host.form.controls.day.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const err = el.querySelector('.field-error')!;
    expect(err.textContent).toContain('dd/mm/yyyy');
    expect(input.getAttribute('aria-describedby')).toBe(err.id);
  });

  it('clears with the × button', async () => {
    const { host, el, settle } = await mount(FormHost);
    host.form.controls.day.setValue('2026-11-23');
    await settle();
    el.querySelector<HTMLButtonElement>('button[aria-label="Clear day"]')!.click();
    await settle();
    expect(host.form.controls.day.value).toBe('');
    expect(el.querySelector('input')!.value).toBe('');
  });

  it('opens a dialog grid driven by the keyboard and picks with Enter', async () => {
    const { host, el, settle } = await mount(FormHost);
    host.form.controls.day.setValue('2026-11-25');
    await settle();
    const trigger = el.querySelector<HTMLButtonElement>('button[aria-label="Choose day"]')!;
    trigger.click();
    await settle();
    expect($('[role="dialog"]')?.getAttribute('aria-label')).toBe('Choose day');
    const grid = $('[role="grid"]')!;
    expect(document.activeElement).toBe(grid);
    expect(grid.getAttribute('aria-activedescendant')).toMatch(/-2026-11-25$/);
    expect(grid.querySelectorAll('[role="columnheader"]')[0].textContent).toBe('Mo');

    key(grid, 'ArrowRight');
    await settle();
    expect(grid.getAttribute('aria-activedescendant')).toMatch(/-2026-11-26$/);
    key(grid, 'PageUp');
    await settle();
    expect(grid.getAttribute('aria-activedescendant')).toMatch(/-2026-10-26$/);
    expect(grid.getAttribute('aria-label')).toBe('October 2026');

    key(grid, 'Enter');
    await settle();
    expect(host.form.controls.day.value).toBe('2026-10-26');
    expect($('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('puts focus back in the grid after a month is picked in the month view', async () => {
    const { host, el, settle } = await mount(FormHost);
    host.form.controls.day.setValue('2026-11-25');
    await settle();
    el.querySelector<HTMLButtonElement>('button[aria-label="Choose day"]')!.click();
    await settle();
    $<HTMLButtonElement>('.mm-dp-title')!.click();
    await settle();
    [...document.querySelectorAll<HTMLButtonElement>('.mm-dp-months button')].find(b => b.textContent === 'Mar')!.click();
    await settle();
    const grid = $('[role="grid"]')!;
    expect(grid.getAttribute('aria-label')).toBe('March 2026');
    expect(document.activeElement).toBe(grid);
  });

  it('closes on Escape without changing the value', async () => {
    const { host, el, settle } = await mount(FormHost);
    host.form.controls.day.setValue('2026-11-25');
    await settle();
    el.querySelector<HTMLButtonElement>('button[aria-label="Choose day"]')!.click();
    await settle();
    key($('[role="grid"]')!, 'ArrowRight');
    key($('[role="grid"]')!, 'Escape');
    await settle();
    expect($('[role="dialog"]')).toBeNull();
    expect(host.form.controls.day.value).toBe('2026-11-25');
  });
});

describe('mm-date-range', () => {
  it('shows From/To labels and flags From after To on both fields', async () => {
    const { host, el, settle } = await mount(RangeHost);
    expect([...el.querySelectorAll('.mm-dp-label')].map(l => l.textContent)).toEqual(['From', 'To']);
    expect(el.querySelector('.mm-dr-label')!.textContent).toBe('Kick-off');

    host.from.set('2026-11-23');
    host.to.set('2026-11-01');
    await settle();
    const err = el.querySelector('.field-error')!;
    expect(err.textContent).toBe(DATE_ORDER_ERROR);
    for (const input of el.querySelectorAll('input')) {
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe(err.id);
    }

    host.to.set('2026-11-30');
    await settle();
    expect(el.querySelector('.field-error')).toBeNull();
    expect(el.querySelector('input')!.getAttribute('aria-invalid')).toBeNull();
  });

  it('picks From then To with two clicks, in either order', async () => {
    const { host, el, settle } = await mount(RangeHost);
    host.from.set('2026-11-10');
    await settle();
    el.querySelector<HTMLButtonElement>('button[aria-label="Choose kick-off from"]')!.click();
    await settle();
    const cell = (iso: string) => document.querySelector<HTMLElement>(`[role="gridcell"][id$="-${iso}"]`)!;
    cell('2026-11-20').click();
    await settle();
    expect(host.from()).toBe('2026-11-10');                      // nothing written until the second click
    expect(cell('2026-11-20').getAttribute('aria-selected')).toBe('true');
    expect($('[role="dialog"]')).not.toBeNull();

    cell('2026-11-12').dispatchEvent(new MouseEvent('mouseenter'));
    await settle();
    expect(cell('2026-11-15').classList).toContain('band');   // hover preview between the two

    cell('2026-11-12').click();
    await settle();
    expect([host.from(), host.to()]).toEqual(['2026-11-12', '2026-11-20']);
    expect($('[role="dialog"]')).toBeNull();
  });

  it.each(['from', 'to'])('enforces both endpoint bounds from the %s calendar trigger', async trigger => {
    const { host, el, settle } = await mount(RangeHost);
    host.from.set('2026-11-10');
    host.to.set('2026-11-12');
    host.min.set('2026-11-05');
    host.max.set('2026-11-25');
    host.fromMax.set('2026-11-15');
    host.toMin.set('2026-11-18');
    await settle();
    el.querySelector<HTMLButtonElement>(`button[aria-label="Choose kick-off ${trigger}"]`)!.click();
    await settle();
    const cell = (iso: string) => $<HTMLElement>(`[role="gridcell"][id$="-${iso}"]`)!;
    expect(cell('2026-11-04').getAttribute('aria-disabled')).toBe('true');
    expect(cell('2026-11-16').getAttribute('aria-disabled')).toBe('true');
    expect(cell('2026-11-26').getAttribute('aria-disabled')).toBe('true');
    expect(cell('2026-11-20').getAttribute('aria-disabled')).toBeNull();
    cell('2026-11-20').click();
    await settle();
    expect(cell('2026-11-21').getAttribute('aria-disabled')).toBe('true');
    cell('2026-11-26').click();
    await settle();
    expect([host.from(), host.to()]).toEqual(['2026-11-10', '2026-11-12']);
    expect($('[role="dialog"]')).not.toBeNull();
    cell('2026-11-05').click();
    await settle();
    expect([host.from(), host.to()]).toEqual(['2026-11-05', '2026-11-20']);
    expect($('[role="dialog"]')).toBeNull();
  });

  it('fills both fields from the "Last 7 days" preset', async () => {
    const { host, el, settle } = await mount(RangeHost);
    el.querySelector<HTMLButtonElement>('button[aria-label="Choose kick-off to"]')!.click();
    await settle();
    [...document.querySelectorAll<HTMLButtonElement>('.mm-dp-presets button')].find(b => b.textContent === 'Last 7 days')!.click();
    await settle();
    const today = new Date();
    expect([host.from(), host.to()]).toEqual([toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), toIso(today)]);
  });

  it('leaves the form untouched when closed after the first click', async () => {
    const { host, el, settle } = await mount(RangeHost);
    host.from.set('2026-11-10');
    host.to.set('2026-11-12');
    await settle();
    el.querySelector<HTMLButtonElement>('button[aria-label="Choose kick-off from"]')!.click();
    await settle();
    document.querySelector<HTMLElement>('[role="gridcell"][id$="-2026-11-20"]')!.click();
    key($('[role="grid"]')!, 'Escape');
    await settle();
    expect($('[role="dialog"]')).toBeNull();
    expect([host.from(), host.to()]).toEqual(['2026-11-10', '2026-11-12']);
  });

  it('clamps presets to the To max and disables those left empty', async () => {
    const { host, el, settle } = await mount(RangeHost);
    const today = new Date();
    const t = toIso(today);
    host.max.set(t);
    await settle();
    el.querySelector<HTMLButtonElement>('button[aria-label="Choose kick-off to"]')!.click();
    await settle();
    const preset = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('.mm-dp-presets button')].find(b => b.textContent === label)!;
    preset('This month').click();
    await settle();
    expect([host.from(), host.to()]).toEqual([toIso(new Date(today.getFullYear(), today.getMonth(), 1)), t]);

    host.max.set(toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)));
    await settle();
    el.querySelector<HTMLButtonElement>('button[aria-label="Choose kick-off to"]')!.click();
    await settle();
    expect(preset('Today').disabled).toBe(true);
    expect(preset('Last 7 days').disabled).toBe(false);
  });
});

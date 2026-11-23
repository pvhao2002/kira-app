import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { FilterBar } from './filter-bar';

@Component({ imports: [FilterBar], template: `<mm-filter-bar [fields]="['result', 'resultScope']" />` })
class ScopedHost {}

@Component({ selector: 'mm-picks-host', imports: [FilterBar], template: `<mm-filter-bar [fields]="['dates', 'market']" />` })
class PicksHost {}

@Component({ selector: 'mm-count-host', imports: [FilterBar], template: `<mm-filter-bar [fields]="['count']" />` })
class CountHost {}

describe('FilterBar and the URL', () => {
  let harnessBar: () => FilterBar;
  async function open(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'page', component: FilterBar }, { path: 'scoped', component: ScopedHost }, { path: 'count', component: CountHost }]),
        provideHttpClient(), provideHttpClientTesting()],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harnessBar = () => harness.fixture.debugElement.query(By.directive(FilterBar)).componentInstance;
    const bar = harnessBar();
    const http = TestBed.inject(HttpTestingController);
    /** Answers the league/model lookups, then waits for the router. */
    const settle = async () => { http.match(() => true).forEach(r => r.flush([])); await harness.fixture.whenStable(); };
    await settle();
    return { bar, router: TestBed.inject(Router), settle, harness };
  }

  it('starts from the filters in the link and leaves the address bar alone', async () => {
    const { bar, router } = await open('/page?league=La%20Liga&market=1X2');
    expect(bar.current()).toMatchObject({ league: 'La Liga', market: '1X2' });
    expect(router.url).toBe('/page?league=La%20Liga&market=1X2');
  });

  it('writes the applied filters to the URL', async () => {
    const { bar, router, settle } = await open('/page');
    bar.form.patchValue({ league: 'EPL', market: ' 1X2 ' });
    bar.apply();
    await settle();
    expect(router.url).toContain('league=EPL');
    expect(router.url).toContain('market=1X2');
    bar.reset();
    await settle();
    expect(router.url).toBe('/page');
  });

  it('shows an inline error and applies nothing when From is after To (UX-110)', async () => {
    const { bar, settle } = await open('/page');
    const emitted: unknown[] = [];
    bar.changed.subscribe(f => emitted.push(f));
    bar.form.patchValue({ from: '2026-12-31', to: '2026-12-01' });
    bar.apply();
    await settle();
    expect(bar.dateError()).toBe('From must be on or before To.');
    expect(emitted).toHaveLength(0);
  });

  it('marks edits as pending until Apply (UX-079)', async () => {
    const { bar } = await open('/page');
    expect(bar.pending()).toBe(false);
    bar.form.patchValue({ league: 'EPL' });
    expect(bar.pending()).toBe(true);
    bar.apply();
    expect(bar.pending()).toBe(false);
  });

  it('blocks a filter submission with invalid date text while allowing Reset', async () => {
    const { bar, harness } = await open('/page?from=2026-12-01');
    bar.collapsed.set(false);
    harness.detectChanges();
    const form = harness.routeNativeElement!.querySelector('form')!;
    const from = form.querySelector('mm-date-input input') as HTMLInputElement;
    const emitted: unknown[] = [];
    bar.changed.subscribe(filters => emitted.push(filters));
    from.value = 'bad date';
    from.dispatchEvent(new Event('input'));
    from.dispatchEvent(new Event('blur'));
    harness.detectChanges();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(emitted).toHaveLength(0);
    bar.reset();
    expect(emitted).toHaveLength(1);
  });

  it('carries the result scope in the filters and the URL when the page offers it (UX-075)', async () => {
    const { router, settle } = await open('/scoped?resultScope=ANY&result=WIN');
    const bar = harnessBar();
    expect(bar.current()).toMatchObject({ result: 'WIN', resultScope: 'ANY' });
    bar.form.patchValue({ resultScope: '' });
    bar.apply();
    await settle();
    expect(router.url).not.toContain('resultScope');
  });
});

describe('FilterBar badge and layout', () => {
  function create(days: number | null, height = 900) {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(FilterBar);
    f.componentRef.setInput('initialDays', days);
    f.detectChanges();
    TestBed.inject(HttpTestingController).match(() => true).forEach(r => r.flush([]));
    return f.componentInstance;
  }

  it('does not count the default date range, and counts a changed range once (UX-042)', () => {
    const bar = create(30);
    expect(bar.activeCount()).toBe(0);
    bar.form.patchValue({ from: '2026-01-01', to: '2026-01-31', league: 'EPL' });
    bar.apply(false);
    expect(bar.activeCount()).toBe(2);
  });

  it('starts collapsed on a short viewport (UX-100)', () => {
    expect(create(null, 390).collapsed()).toBe(true);
  });
});

describe('FilterBar count policy (UX-046)', () => {
  async function open(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'count', component: CountHost }]), provideHttpClient(), provideHttpClientTesting()],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    const bar = harness.fixture.debugElement.query(By.directive(FilterBar)).componentInstance as FilterBar;
    const settle = async () => { TestBed.inject(HttpTestingController).match(() => true).forEach(r => r.flush([])); await harness.fixture.whenStable(); };
    await settle();
    return { bar, router: TestBed.inject(Router), settle, el: harness.fixture.nativeElement as HTMLElement };
  }

  it('reads ?count=all as countPolicy=all and writes it back only when not the default', async () => {
    const { bar, router, settle, el } = await open('/count?count=all');
    expect(bar.current().countPolicy).toBe('all');
    bar.collapsed.set(false);
    await settle();
    expect(el.querySelector('button[role="combobox"][aria-label="Count"]')).not.toBeNull();
    expect(el.querySelector('select, input[type=date]')).toBeNull();   // custom controls only (CUSTOM-1/2)
    bar.form.patchValue({ count: '' });
    bar.apply();
    await settle();
    expect(bar.current().countPolicy).toBeUndefined();
    expect(router.url).not.toContain('count=');
  });
});

describe('FilterBar custom controls (CUSTOM-1/2, DS-9)', () => {
  it('a market pick lands in the form, and From after To shows one linked error and blocks Apply', async () => {
    Element.prototype.scrollIntoView ??= () => {};   // jsdom lacks it; cdkOption calls it
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'picks', component: PicksHost }]), provideHttpClient(), provideHttpClientTesting()] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/picks');
    const bar = harness.fixture.debugElement.query(By.directive(FilterBar)).componentInstance as FilterBar;
    const el = harness.fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    bar.collapsed.set(false);
    await harness.fixture.whenStable();

    (el.querySelector('button[aria-label="Market"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    (document.querySelectorAll('[role="option"]')[1] as HTMLElement).click();
    await harness.fixture.whenStable();
    expect(bar.form.getRawValue().market).toBe(bar.marketOptions[1].value);
    expect(bar.pending()).toBe(true);

    bar.form.patchValue({ from: '2026-12-31', to: '2026-12-01' });
    await harness.fixture.whenStable();
    const alerts = [...el.querySelectorAll('[role="alert"]')].map(a => a.textContent?.trim());
    expect(alerts).toEqual(['From must be on or before To.']);
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    el.remove();
  });
});

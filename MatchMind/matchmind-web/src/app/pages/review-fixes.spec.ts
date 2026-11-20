import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmService } from '../shared/kit';
import { MatchesPage } from './matches';
import { ModelBreakdown, ReportsPage } from './reports';
import { SettingsPage } from './settings';

const admin = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '', updatedAt: '' };
const bob = { ...admin, id: 'u2', username: 'bob', role: 'VIEWER' };

let http: HttpTestingController;
beforeEach(() => {
  sessionStorage.setItem('matchmind.session',
    JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: admin }));
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => sessionStorage.clear());

describe('ReportsPage', () => {
  // The filter bar also asks for its league and model lists; whenStable() waits for them.
  const lookups = () => http.match(r => !r.url.includes('/reports/')).forEach(r => r.flush([]));

  it('drops a model breakdown that was requested under the previous filters', async () => {
    const f = TestBed.createComponent(ModelBreakdown);
    f.componentRef.setInput('modelId', 'm1');
    f.componentRef.setInput('filters', {});
    f.detectChanges();
    TestBed.tick();
    const pending = http.match(r => r.url.endsWith('/reports/breakdown'));
    expect(pending).toHaveLength(2);

    f.componentRef.setInput('filters', { league: 'La Liga' });
    TestBed.tick();
    expect(pending.every(r => r.cancelled)).toBe(true);
    http.match(r => r.url.endsWith('/reports/breakdown')).forEach(r => r.flush([]));
  });

  it('shows the API message instead of an endless skeleton when a breakdown fails', async () => {
    const f = TestBed.createComponent(ModelBreakdown);
    f.componentRef.setInput('modelId', 'm1');
    f.componentRef.setInput('filters', {});
    f.detectChanges();
    TestBed.tick();
    // forkJoin cancels its sibling request once one fails.
    http.match(r => r.url.endsWith('/reports/breakdown'))[0]
      .flush({ status: 500, code: 'X', message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await f.whenStable();
    expect(f.componentInstance.state()).toBe('error');
    expect(f.componentInstance.error()).toBe('boom');
  });

  it('shows no history rows from a filter whose request failed', async () => {
    const f = TestBed.createComponent(ReportsPage);
    const c = f.componentInstance;
    f.componentRef.setInput('tab', 'history');
    f.detectChanges(); // the filter bar reports its first filters on init
    TestBed.tick();
    lookups();
    http.expectOne(r => r.url.endsWith('/reports/prediction-history'))
      .flush({ data: [{ pickId: 'old' }], meta: { totalElements: 1 } });
    await f.whenStable();
    expect(c.historyRows()).toHaveLength(1);

    c.onFilters({ from: '2026-11-20T00:00:00Z', to: '2026-11-10T00:00:00Z' });
    TestBed.tick();
    http.expectOne(r => r.url.endsWith('/reports/prediction-history'))
      .flush({ status: 400, code: 'INVALID_DATE_RANGE', message: 'from must be before to' }, { status: 400, statusText: 'Bad Request' });
    await f.whenStable();
    expect(c.historyRows()).toEqual([]);
    expect(c.historyTotal()).toBe(0);
    expect(c.state()).toBe('error');
    expect(c.error()).toBe('from must be before to');
  });

  it('keeps the last rows on screen while the next page loads, and cancels the stale request', async () => {
    const f = TestBed.createComponent(ReportsPage);
    const c = f.componentInstance;
    f.componentRef.setInput('tab', 'history');
    f.detectChanges();
    TestBed.tick();
    lookups();
    http.expectOne(r => r.url.endsWith('/reports/prediction-history')).flush({ data: [{ pickId: 'p1' }], meta: { totalElements: 80 } });
    await f.whenStable();

    c.setHistoryPage({ page: 1, size: 50 });
    TestBed.tick();
    expect(c.state()).toBe('loading');
    expect(c.historyRows()).toHaveLength(1);
    const next = http.expectOne(r => r.url.endsWith('/reports/prediction-history'));
    c.setHistoryPage({ page: 2, size: 50 });
    TestBed.tick();
    expect(next.cancelled).toBe(true);
    http.expectOne(r => r.url.endsWith('/reports/prediction-history')).flush({ data: [{ pickId: 'p3' }], meta: { totalElements: 80 } });
    await f.whenStable();
    expect(c.historyRows()).toEqual([{ pickId: 'p3' }]);
  });

  it('requests only the active tab', async () => {
    const f = TestBed.createComponent(ReportsPage);
    f.componentRef.setInput('tab', 'markets');
    f.detectChanges();
    TestBed.tick();
    http.expectOne(r => r.url.endsWith('/reports/market-performance')).flush([]);
    http.expectNone(r => r.url.includes('/reports/'));
  });
});

describe('SettingsPage', () => {
  it('puts the role dropdown back when the server rejects the change', async () => {
    const f = TestBed.createComponent(SettingsPage);
    f.detectChanges();
    TestBed.tick();
    http.match('/api/v1/users').forEach(r => r.flush([admin, bob]));
    await f.whenStable();

    const select = f.nativeElement.querySelector('select[aria-label="Role of bob"]') as HTMLSelectElement;
    select.value = 'ADMIN';
    select.dispatchEvent(new Event('change'));
    TestBed.inject(ConfirmService).answer(true); // UX-044: a role change is confirmed first
    (await vi.waitFor(() => http.expectOne('/api/v1/users/u2'))).flush({ status: 403, code: 'FORBIDDEN', message: 'no' }, { status: 403, statusText: 'Forbidden' });
    TestBed.tick();
    http.match('/api/v1/users').forEach(r => r.flush([admin, bob]));
    await f.whenStable();
    expect(select.value).toBe('VIEWER');
  });
});

describe('Filter state from the URL', () => {
  it('MatchesPage restores filters from the query string and sends them on the first request', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ search: ' Arsenal ', status: 'FINISHED', sort: 'startTime,asc' }) } } }] });
    const h = TestBed.inject(HttpTestingController);
    const c = TestBed.runInInjectionContext(() => new MatchesPage());
    expect(c.search()).toBe(' Arsenal ');
    TestBed.tick();
    const req = h.expectOne(r => r.url.endsWith('/matches'));
    expect(req.request.params.get('search')).toBe('Arsenal');
    expect(req.request.params.get('status')).toBe('FINISHED');
    expect(req.request.params.get('sort')).toBe('startTime,asc');
    h.match(() => true).forEach(r => r.flush([]));
  });
});

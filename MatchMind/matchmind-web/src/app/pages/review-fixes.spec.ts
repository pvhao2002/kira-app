import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelPerformanceRow } from '../core/models';
import { ReportsPage } from './reports';
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
  it('drops a model breakdown that was requested under the previous filters', async () => {
    const f = TestBed.createComponent(ReportsPage);
    const c = f.componentInstance;
    c.onFilters({});
    c.toggleModel({ modelId: 'm1' } as ModelPerformanceRow);
    const pending = http.match(r => r.url.endsWith('/reports/breakdown'));
    expect(pending).toHaveLength(2);

    c.onFilters({ league: 'La Liga' });
    expect(pending.every(r => r.cancelled)).toBe(true);
    expect(c.modelBreakdowns()).toEqual({});
  });

  it('clears the history rows when a request fails', async () => {
    const f = TestBed.createComponent(ReportsPage);
    const c = f.componentInstance;
    c.tab.set('history');
    c.historyRows.set([{ pickId: 'old' } as never]);
    c.historyTotal.set(1);
    c.onFilters({ from: '2026-11-20T00:00:00Z', to: '2026-11-10T00:00:00Z' });
    http.match(r => r.url.includes('/reports/')).forEach(r =>
      r.flush({ status: 400, code: 'INVALID_DATE_RANGE', message: 'from must be before to' }, { status: 400, statusText: 'Bad Request' }));
    expect(c.historyRows()).toEqual([]);
    expect(c.historyTotal()).toBe(0);
    expect(c.state()).toBe('error');
  });
});

describe('SettingsPage', () => {
  it('puts the role dropdown back when the server rejects the change', async () => {
    const f = TestBed.createComponent(SettingsPage);
    await f.whenStable();
    http.match('/api/v1/users').forEach(r => r.flush([admin, bob]));
    await f.whenStable();

    const select = f.nativeElement.querySelector('select[aria-label="Role of bob"]') as HTMLSelectElement;
    select.value = 'ADMIN';
    select.dispatchEvent(new Event('change'));
    http.expectOne('/api/v1/users/u2').flush({ status: 403, code: 'FORBIDDEN', message: 'no' }, { status: 403, statusText: 'Forbidden' });
    http.match('/api/v1/users').forEach(r => r.flush([admin, bob]));
    await f.whenStable();
    expect(select.value).toBe('VIEWER');
  });
});

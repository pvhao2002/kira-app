import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../core/auth.service';
import { ActivityPage, activityLabel } from './activity';

const row = (over: object) => ({ id: crypto.randomUUID(), at: '2026-11-25T05:00:00Z', username: 'kira', method: 'POST',
  path: '/api/v1/auth/login', status: 200, clientIp: '203.0.113.7', userAgent: 'UA', browser: 'Chrome', os: 'Windows', ...over });

async function open(admin: boolean) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
    { provide: AuthService, useValue: { isAdmin: signal(admin) } }] });
  const fixture = TestBed.createComponent(ActivityPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

describe('activityLabel', () => {
  it('names sign-ins by outcome and known changes in words', () => {
    expect(activityLabel(row({}))).toBe('Signed in');
    expect(activityLabel(row({ status: 401 }))).toBe('Sign-in failed');
    expect(activityLabel(row({ status: 429 }))).toContain('blocked');
    expect(activityLabel(row({ method: 'DELETE', path: '/api/v1/parlays/3f2b6a2e-1c1d-4a5b-9f00-0123456789ab' }))).toBe('Deleted a parlay');
    expect(activityLabel(row({ method: 'PUT', path: '/api/v1/models/x' }))).toBe('PUT /models/x');
  });
});

describe('ActivityPage', () => {
  it('shows a viewer their own activity without a user column or filter', async () => {
    const { fixture, http, el } = await open(false);
    http.expectOne('/api/v1/activity?page=0&size=50').flush({ data: [row({}), row({ status: 401 })], meta: { page: 0, size: 50, totalElements: 2, totalPages: 1 } });
    await fixture.whenStable();
    expect(el.textContent).toContain('Signed in');
    expect(el.textContent).toContain('Sign-in failed');
    expect(el.textContent).toContain('203.0.113.7');
    expect(el.querySelector('#activity-user')).toBeNull();
    expect([...el.querySelectorAll('thead th')].map(t => t.textContent)).not.toContain('User');
    http.verify();
  });

  it('lets an admin narrow the list to one user', async () => {
    const { fixture, http, el } = await open(true);
    http.expectOne('/api/v1/activity?page=0&size=50').flush({ data: [row({ username: null, status: 401 })], meta: { page: 0, size: 50, totalElements: 1, totalPages: 1 } });
    await fixture.whenStable();
    expect(el.textContent).toContain('Unknown username');
    el.querySelector<HTMLInputElement>('#activity-user')!.value = ' kira ';
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    TestBed.tick();
    http.expectOne('/api/v1/activity?username=kira&page=0&size=50').flush({ data: [], meta: { page: 0, size: 50, totalElements: 0, totalPages: 0 } });
    await fixture.whenStable();
    expect(el.textContent).toContain('No activity yet.');
    http.verify();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { User } from '../core/models';
import { ConfirmService, ToastService } from '../shared/kit';
import { SettingsPage } from './settings';

const me: User = { id: 'u1', username: 'admin', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: '2026-11-20T01:20:00Z', createdAt: '', updatedAt: '' };
const kim: User = { id: 'u2', username: 'kim', role: 'VIEWER', status: 'ACTIVE', lastLoginAt: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '', loginLocked: true };
const lee: User = { ...kim, id: 'u3', username: 'lee', loginLocked: false };
const emptyPage = { data: [], meta: { page: 0, size: 10, totalElements: 0, totalPages: 0 } };
const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';
const q = <T extends HTMLElement>(f: ComponentFixture<unknown>, sel: string) => f.nativeElement.querySelector(sel) as T;

describe('SettingsPage (W5)', () => {
  let http: HttpTestingController;
  afterEach(() => http.verify());

  async function open(user: User = me, flush = true) {
    sessionStorage.clear();
    sessionStorage.setItem('matchmind.session', JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(SettingsPage);
    f.detectChanges();
    if (flush) {
      http.expectOne('/api/v1/auth/me').flush({ ...user, lastLoginAt: '2026-11-20T01:44:00Z' });
      if (user.role === 'ADMIN') {
        http.expectOne('/api/v1/users').flush([user, kim, lee]);
        http.expectOne(r => r.url === '/api/v1/users/audit').flush(emptyPage);
      }
      await f.whenStable();
    }
    return f;
  }

  it('Account card shows the sign-in time the Users table shows (UX-070)', async () => {
    const f = await open();
    expect(f.componentInstance.account()?.lastLoginAt).toBe('2026-11-20T01:44:00Z');
  });

  it('Sign out everywhere asks, then ends every session (UX-090)', async () => {
    const f = await open({ ...me, role: 'VIEWER' });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(text(f.nativeElement)).toContain('Sign out everywhere');
    const done = f.componentInstance.signOutEverywhere();
    TestBed.inject(ConfirmService).answer(true);
    await done;
    http.expectOne('/api/v1/auth/logout-all').flush(null);
  });

  it('a user with a temporary password is told to change it (UX-059)', async () => {
    const f = await open({ ...me, role: 'VIEWER', mustChangePassword: true });
    expect(text(f.nativeElement)).toContain('Choose a new password');
  });

  it('shows the password rules and the policy errors of the API (UX-031, UX-062)', async () => {
    const f = await open({ ...me, role: 'VIEWER' });
    expect(text(f.nativeElement)).toContain('not a common password');
    f.componentInstance.pw.setValue({ currentPassword: 'old-password', newPassword: 'password123', confirm: 'password123' });
    f.componentInstance.changePassword();
    http.expectOne('/api/v1/auth/change-password').flush({ status: 400, code: 'WEAK_PASSWORD', message: 'Password is too weak',
      fieldErrors: { newPassword: 'Too common: pick a password that is not on common-password lists' } }, { status: 400, statusText: 'Bad Request' });
    await f.whenStable();
    expect(text(f.nativeElement)).toContain('Too common: pick a password');
  });

  it('Add user: Generate fills a password shown once, mustChangePassword is on, a double submit sends once (UX-059, UX-109)', async () => {
    const f = await open();
    const c = f.componentInstance;
    c.openCreate();
    c.newUsername.set('newbie');
    c.generate();
    http.expectOne('/api/v1/users/generate-password').flush({ password: 'Gen3rated-Pass!xy' });
    await f.whenStable();
    expect(c.newPassword()).toBe('Gen3rated-Pass!xy');
    expect(c.showNewPassword()).toBe(true);
    expect(c.mustChange()).toBe(true);
    c.submitDialog();
    c.submitDialog();
    const req = http.expectOne('/api/v1/users');
    expect(req.request.body).toEqual({ username: 'newbie', password: 'Gen3rated-Pass!xy', role: 'VIEWER', mustChangePassword: true });
    req.flush({ ...kim, id: 'u9', username: 'newbie' });
    TestBed.tick(); // the users resource reloads on the next tick
    http.expectOne('/api/v1/users').flush([me, kim, lee]);
    http.expectOne(r => r.url === '/api/v1/users/audit').flush(emptyPage);
    expect(c.newPassword()).toBe('');
  });

  it('a role change needs confirmation; declining keeps the old role (UX-044)', async () => {
    const f = await open();
    const select = q<HTMLSelectElement>(f, 'select[aria-label="Role of kim"]');
    select.value = 'ADMIN';
    const declined = f.componentInstance.setRole(kim, { target: select } as unknown as Event);
    TestBed.inject(ConfirmService).answer(false);
    await declined;
    http.expectNone('/api/v1/users/u2');
    expect(select.value).toBe('VIEWER');

    const toast = vi.spyOn(TestBed.inject(ToastService), 'add');
    select.value = 'ADMIN';
    const accepted = f.componentInstance.setRole(kim, { target: select } as unknown as Event);
    expect(TestBed.inject(ConfirmService).current()?.header).toContain('kim');
    TestBed.inject(ConfirmService).answer(true);
    await accepted;
    const req = http.expectOne('/api/v1/users/u2');
    expect(req.request.body).toEqual({ role: 'ADMIN' });
    req.flush({ ...kim, role: 'ADMIN' });
    http.expectOne(r => r.url === '/api/v1/users/audit').flush(emptyPage);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success', summary: 'Role changed' }));
  });

  it('Disable asks first and confirms with a toast (UX-042)', async () => {
    const f = await open();
    const toast = vi.spyOn(TestBed.inject(ToastService), 'add');
    const done = f.componentInstance.toggleStatus(lee);
    TestBed.inject(ConfirmService).answer(true);
    await done;
    http.expectOne('/api/v1/users/u3').flush({ ...lee, status: 'DISABLED' });
    http.expectOne(r => r.url === '/api/v1/users/audit').flush(emptyPage);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ summary: 'User disabled' }));
  });

  it('a locked user shows a badge and can be unlocked (UX-043)', async () => {
    const f = await open();
    expect(text(f.nativeElement)).toContain('Locked');
    (q<HTMLButtonElement>(f, '[data-testid="unlock-u2"]')).click();
    http.expectOne('/api/v1/users/u2/unlock').flush(null);
    http.expectOne(r => r.url === '/api/v1/users/audit').flush(emptyPage);
    await f.whenStable();
    expect(f.componentInstance.users().find(u => u.id === 'u2')?.loginLocked).toBe(false);
  });

  it('lists who changed which account (UX-044)', async () => {
    const f = await open(me, false);
    http.expectOne('/api/v1/auth/me').flush(me);
    http.expectOne('/api/v1/users').flush([me, kim]);
    const audit = http.expectOne(r => r.url === '/api/v1/users/audit');
    expect(audit.request.params.get('size')).toBe('10');
    audit.flush({ data: [{ id: 'a1', at: '2026-11-20T02:00:00Z', actor: 'admin', targetId: 'u2', target: 'kim', action: 'ROLE_CHANGED',
      oldValue: 'VIEWER', newValue: 'ADMIN', clientIp: null }], meta: { page: 0, size: 10, totalElements: 1, totalPages: 1 } });
    await f.whenStable();
    const panel = text(q(f, '[data-testid="user-audit"]'));
    expect(panel).toContain('Role changed');
    expect(panel).toContain('Viewer → Admin');
    expect(panel).toContain('kim');
  });

  it('filters users by name and explains how to connect an agent without showing the key (UX-020)', async () => {
    const f = await open();
    f.componentInstance.userSearch.set('LE');
    await f.whenStable();
    expect(f.componentInstance.shownUsers().map(u => u.username)).toEqual(['lee']);
    const card = text(q(f, '[data-testid="connect-agent"]'));
    expect(card).toContain('/api/v1/external/predictions');
    for (const h of ['X-Api-Key', 'X-Provider', 'X-Model-Name', 'X-Model-Version']) expect(card).toContain(h);
    expect(card).toContain('EXTERNAL_API_KEY');
  });

  it('the status filter sends ?status= (archive plan Task 5)', async () => {
    const f = await open();
    const sel = q<HTMLSelectElement>(f, '[data-testid="user-status"]');
    sel.value = 'DISABLED';
    sel.dispatchEvent(new Event('change'));
    TestBed.tick();
    const r = http.expectOne(x => x.url === '/api/v1/users');
    expect(r.request.params.get('status')).toBe('DISABLED');
    r.flush([{ ...kim, status: 'DISABLED' }]);
  });
});

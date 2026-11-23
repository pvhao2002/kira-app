import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
  beforeAll(() => { Element.prototype.scrollIntoView ??= () => {}; });   // jsdom lacks it; cdkOption calls it
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

  /** Opens an mm-select trigger and clicks the option with this label (the real pick path, not a DOM change event). */
  async function pick(f: ComponentFixture<unknown>, triggerSel: string, label: string) {
    q<HTMLButtonElement>(f, triggerSel).click();
    await f.whenStable();
    const opt = [...document.querySelectorAll('[role="option"]')].find(o => o.textContent?.trim().startsWith(label)) as HTMLElement;
    opt.click();
    await new Promise(r => setTimeout(r));   // not whenStable: the pick may start a request, and a pending request keeps it waiting
    f.detectChanges();
  }

  it('a role change needs confirmation; declining keeps the old role (UX-044)', async () => {
    const f = await open();
    document.body.appendChild(f.nativeElement);
    const trigger = () => q<HTMLButtonElement>(f, 'button[aria-label="Role of kim"]');
    expect(trigger().textContent).toContain('Viewer');
    await pick(f, 'button[aria-label="Role of kim"]', 'Admin');
    const confirm = TestBed.inject(ConfirmService);
    expect(confirm.current()?.header).toContain('kim');
    confirm.answer(false);
    await new Promise(r => setTimeout(r));
    f.detectChanges();
    http.expectNone('/api/v1/users/u2');
    expect(trigger().textContent).toContain('Viewer');

    const toast = vi.spyOn(TestBed.inject(ToastService), 'add');
    await pick(f, 'button[aria-label="Role of kim"]', 'Admin');
    confirm.answer(true);
    const req = await vi.waitFor(() => http.expectOne('/api/v1/users/u2'));
    expect(req.request.body).toEqual({ role: 'ADMIN' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('tr .pi-spinner')).not.toBeNull();   // SET-2: the row shows it is saving
    req.flush({ ...kim, role: 'ADMIN' });
    http.expectOne(r => r.url === '/api/v1/users/audit').flush(emptyPage);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success', summary: 'Role changed' }));
    document.body.innerHTML = '';
  });

  it('browsing the role list without picking never asks for confirmation (SET-1)', async () => {
    const f = await open();
    document.body.appendChild(f.nativeElement);
    q<HTMLButtonElement>(f, 'button[aria-label="Role of kim"]').click();
    await f.whenStable();
    const list = document.querySelector('[role="listbox"]') as HTMLElement;
    for (const [key, keyCode] of [['ArrowDown', 40], ['ArrowUp', 38], ['Escape', 27]] as const) {
      list.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true }));
    }
    await f.whenStable();
    expect(TestBed.inject(ConfirmService).current()).toBeNull();
    http.expectNone('/api/v1/users/u2');
    document.body.innerHTML = '';
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

  it('hides Connect an agent from viewers: its keys and Import are admin-only', async () => {
    const f = await open({ ...me, role: 'VIEWER' });
    expect(q(f, '[data-testid="connect-agent"]')).toBeNull();
  });

  it('the status filter sends ?status= (archive plan Task 5)', async () => {
    const f = await open();
    document.body.appendChild(f.nativeElement);
    expect(q<HTMLButtonElement>(f, '[data-testid="user-status"] button').textContent).toContain('All statuses');   // SET-15
    await pick(f, '[data-testid="user-status"] button', 'Disabled');
    TestBed.tick();
    const r = http.expectOne(x => x.url === '/api/v1/users');
    expect(r.request.params.get('status')).toBe('DISABLED');
    r.flush([{ ...kim, status: 'DISABLED' }]);
    document.body.innerHTML = '';
  });

  it('shows what is wrong with the new password, links it to the field and focuses the first one (SET-5, SET-6)', async () => {
    const f = await open({ ...me, role: 'VIEWER' });
    document.body.appendChild(f.nativeElement);
    const submit = q<HTMLButtonElement>(f, 'form button[type="submit"]');
    expect(submit.disabled).toBe(false);   // never a dead button
    f.componentInstance.changePassword();
    await f.whenStable();
    expect(text(f.nativeElement)).toContain('Enter your current password.');
    expect(q(f, '#cur').getAttribute('aria-invalid')).toBe('true');
    expect(q(f, '#cur').getAttribute('aria-describedby')).toBe('cur-error');
    expect(document.activeElement).toBe(q(f, '#cur'));
    f.componentInstance.pw.setValue({ currentPassword: 'old-password', newPassword: 'short', confirm: 'short' });
    f.componentInstance.changePassword();
    await f.whenStable();
    expect(q(f, '#new-error').textContent).toBe('Use at least 10 characters.');
    expect(q(f, '#new').getAttribute('aria-describedby')).toBe('new-error new-rules');
    f.componentInstance.pw.setValue({ currentPassword: 'old-password', newPassword: 'a-long-password', confirm: 'different-one' });
    f.componentInstance.changePassword();
    await f.whenStable();
    expect(q(f, '#confirm-error').textContent).toBe("The passwords don't match.");
    http.expectNone('/api/v1/auth/change-password');
    document.body.innerHTML = '';
  });

  it('Unlock disables the row actions while it runs, so a double click sends once (SET-2, SET-7)', async () => {
    const f = await open();
    const unlock = q<HTMLButtonElement>(f, '[data-testid="unlock-u2"]');
    expect(unlock.getAttribute('aria-label')).toBe('Unlock kim');
    unlock.click();
    await f.whenStable();
    expect(unlock.disabled).toBe(true);
    unlock.click();
    http.expectOne('/api/v1/users/u2/unlock').flush(null);
    http.expectOne(r => r.url === '/api/v1/users/audit').flush(emptyPage);
  });

  it('says loading, not "No account changes yet", until the audit arrives, and offers Retry when it fails (SET-3, SET-4)', async () => {
    const f = await open(me, false);
    http.expectOne('/api/v1/auth/me').flush(me);
    http.expectOne('/api/v1/users').flush([me, kim]);
    const audit = http.expectOne(r => r.url === '/api/v1/users/audit');
    f.detectChanges();
    const panel = () => q(f, '[data-testid="user-audit"]');
    expect(panel().querySelector('mm-state[state="loading"]')).not.toBeNull();
    expect(text(panel())).not.toContain('No account changes yet');
    audit.flush({ status: 500, code: 'X', message: 'Audit is down' }, { status: 500, statusText: 'Server Error' });
    await f.whenStable();
    expect(text(panel())).toContain('Audit is down');
    (panel().querySelector('[data-testid="state-retry"]') as HTMLButtonElement).click();
    http.expectOne(r => r.url === '/api/v1/users/audit').flush(emptyPage);
    await f.whenStable();
    expect(text(panel())).toContain('No account changes yet.');
  });

  it('retains audit rows, retries the failed page, and supersedes older requests', async () => {
    const f = await open(me, false);
    http.expectOne('/api/v1/auth/me').flush(me);
    http.expectOne('/api/v1/users').flush([me, kim]);
    const auditAt = (page: number) => http.expectOne(r =>
      r.url === '/api/v1/users/audit' && r.params.get('page') === String(page));
    const auditRow = { id: 'a1', at: '2026-11-20T02:00:00Z', actor: 'admin', targetId: 'u2', target: 'kim', action: 'ROLE_CHANGED' };
    const meta = { page: 0, size: 10, totalElements: 12, totalPages: 2 };
    auditAt(0).flush({ data: [auditRow], meta });
    await f.whenStable();

    const panel = q(f, '[data-testid="user-audit"]');
    const next = panel.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!;
    next.click();
    auditAt(1).flush({ code: 'DOWN', message: 'Audit is down' }, { status: 500, statusText: 'Server Error' });
    await f.whenStable();
    expect(text(panel.querySelector('tbody')!)).toContain('kim');
    expect(text(panel)).toContain('Could not load page 2');
    expect(text(panel)).toContain('Audit is down');
    panel.querySelector<HTMLButtonElement>('[data-testid="state-retry"]')!.click();
    const retry = auditAt(1);
    f.componentInstance.loadAudit(0);
    expect(retry.cancelled).toBe(true);
    auditAt(0).flush({ data: [auditRow], meta });
    await f.whenStable();
    expect(panel.querySelector('[data-testid="state-retry"]')).toBeNull();

    next.click();
    auditAt(1).flush({ data: [{ ...auditRow, id: 'a2', target: 'lee' }], meta: { ...meta, page: 1 } });
    await f.whenStable();
    expect(text(panel.querySelector('tbody')!)).toContain('lee');
    expect(text(panel.querySelector('tbody')!)).not.toContain('kim');
  });
});

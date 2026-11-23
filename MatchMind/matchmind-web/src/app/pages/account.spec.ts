import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CopyService } from '../shared/copy';
import { AccountPage } from './account';

describe('Account Management', () => {
  it('renders the ledger and changes the report period without reloading transactions', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AccountPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const totals = { deposits: 100, withdrawals: 80, rewards: 5, profit: -20 };
    http.expectOne('/api/v1/account/transactions?page=0&size=25').flush({
      meta: { page: 0, size: 25, totalElements: 1, totalPages: 1 },
      transactions: [{ reference: 'WD-17', type: 'DEBIT', status: 'CANCELLED', amount: 80, occurredAt: '2026-11-19T12:00:00Z' }],
      reports: { allTime: totals, weekly: [{ periodStart: '2026-11-16', ...totals }], monthly: [] },
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('WD-17');
    expect(fixture.nativeElement.textContent).toContain('-20');
    fixture.nativeElement.querySelector('[data-period="weekly"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2026-11-16');
    http.verify();
  });

  it('uploads all selected screenshots in one request and copies the one prompt', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AccountPage);
    const http = TestBed.inject(HttpTestingController);
    const copy = vi.spyOn(TestBed.inject(CopyService), 'copy').mockResolvedValue(true);
    fixture.detectChanges();
    http.expectOne('/api/v1/account/transactions?page=0&size=25').flush({
      meta: { page: 0, size: 25, totalElements: 0, totalPages: 0 },
      transactions: [], reports: { allTime: { deposits: 0, withdrawals: 0, rewards: 0, profit: 0 }, weekly: [], monthly: [] },
    });
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    expect(input.multiple).toBe(true);
    Object.defineProperty(input, 'files', { value: files });
    input.dispatchEvent(new Event('change'));
    const upload = http.expectOne('/api/v1/account/images');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body.getAll('file')).toEqual(files);
    upload.flush({ importId: 'abc', prompt: 'Read screenshot for abc' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('attach these 2 screenshots');
    fixture.nativeElement.querySelector('[data-action="copy"]').click();
    expect(copy).toHaveBeenCalledWith('Read screenshot for abc', 'Account import prompt');
    http.verify();
  });
});

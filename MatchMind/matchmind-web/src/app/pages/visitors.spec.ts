import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { VisitorsPage } from './visitors';

describe('Visitors', () => {
  it('lists countries collapsed and loads 100 visits of a country when it is opened', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(VisitorsPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/visits/countries').flush([
      { country: 'VN', visits: 120, uniqueIps: 80, lastSeen: '2026-11-24T05:00:00Z' },
      { country: 'XX', visits: 2, uniqueIps: 2, lastSeen: '2026-11-23T05:00:00Z' },
    ]);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Vietnam');
    expect(el.textContent).toContain('Unknown');
    expect(el.textContent).toContain('120 visits');
    http.expectNone(req => req.url === '/api/v1/visits');

    const vn = el.querySelector<HTMLDetailsElement>('details[data-country="VN"]')!;
    vn.open = true;
    vn.dispatchEvent(new Event('toggle'));
    TestBed.tick();
    http.expectOne('/api/v1/visits?country=VN&page=0&size=100').flush({
      data: [{ id: 1, visitedAt: '2026-11-24T05:00:00Z', ip: '203.0.113.7', country: 'VN', browser: 'Chrome', os: 'Windows', userAgent: 'UA' }],
      meta: { page: 0, size: 100, totalElements: 120, totalPages: 2 },
    });
    await fixture.whenStable();
    expect(vn.textContent).toContain('203.0.113.7');
    expect(vn.textContent).toContain('Chrome');
    http.verify();
  });
});

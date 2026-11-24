import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { ParlaySlip, ParlaySlipPanel } from './parlay-slip';

const leg = (pickId: string, matchId: string, price: number) => ({ pickId, matchId, match: matchId, pick: 'AH HOME -0.25', price });

describe('ParlaySlip', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* none */ }
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  it('keeps one pick per match, multiplies the prices and survives a reload', () => {
    const slip = TestBed.inject(ParlaySlip);
    slip.add(leg('a1', 'A', 2));
    slip.add(leg('b1', 'B', 1.8));
    slip.add(leg('a2', 'A', 1.9));   // replaces a1
    expect(slip.legs().map(l => l.pickId)).toEqual(['b1', 'a2']);
    expect(slip.totalOdds()).toBeCloseTo(3.42);
    expect(new ParlaySlip().legs().map(l => l.pickId)).toEqual(['b1', 'a2']);
    slip.remove('b1');
    expect(slip.has('b1')).toBe(false);
  });

  it('saves the picks and stake, then empties the slip', async () => {
    const slip = TestBed.inject(ParlaySlip);
    slip.add(leg('a1', 'A', 2));
    slip.add(leg('b1', 'B', 1.8));
    slip.open.set(true);
    const fixture = TestBed.createComponent(ParlaySlipPanel);
    fixture.componentInstance.stake = 50;
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="slip-odds"]')!.textContent).toContain('3.60');
    el.querySelector<HTMLButtonElement>('[data-testid="slip-save"]')!.click();
    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/parlays');
    expect(req.request.body).toEqual({ pickIds: ['a1', 'b1'], stake: 50 });
    req.flush({ id: 'x' }, { status: 201, statusText: 'Created' });
    expect(slip.legs()).toEqual([]);
  });
});

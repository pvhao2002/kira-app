import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { FilterBar } from './filter-bar';

describe('FilterBar and the URL', () => {
  async function open(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'page', component: FilterBar }]), provideHttpClient(), provideHttpClientTesting()],
    });
    const harness = await RouterTestingHarness.create();
    const bar = await harness.navigateByUrl(url, FilterBar);
    const http = TestBed.inject(HttpTestingController);
    /** Answers the league/model lookups, then waits for the router. */
    const settle = async () => { http.match(() => true).forEach(r => r.flush([])); await harness.fixture.whenStable(); };
    await settle();
    return { bar, router: TestBed.inject(Router), settle };
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
});

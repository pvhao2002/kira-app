import {TestBed} from '@angular/core/testing';
import {LoveDays} from './love-days';

describe('LoveDays', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({toFake: ['Date']});
  });
  afterEach(() => vi.useRealTimers());

  it('celebrates a milestone that begins while the tab is open', () => {
    vi.setSystemTime(new Date('2026-12-08T23:50:00+07:00'));
    const fixture = TestBed.createComponent(LoveDays);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-celebration')).toBeNull();

    // Day 3,100 starts at midnight; the tab comes back in the morning.
    vi.setSystemTime(new Date('2026-12-09T08:00:00+07:00'));
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3.100 ngày');
    expect(fixture.nativeElement.querySelector('app-celebration')).not.toBeNull();
  });
});

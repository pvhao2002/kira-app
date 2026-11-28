import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {Api} from '../../core/api';
import {CycleCard} from './cycle-card';

/** A tab opened late in the evening and brought back the next morning (Vietnam time). */
const EVENING = new Date('2026-11-27T23:50:00+07:00');
const MORNING = new Date('2026-11-28T07:30:00+07:00');

function open(starts: string[], added: string[] = []) {
  TestBed.configureTestingModule({providers: [{provide: Api, useValue: {
    cycle: () => of({starts}),
    addCycleStart: (day: string) => {
      added.push(day);
      return of({starts: [day, ...starts]});
    }
  }}]});
  const fixture = TestBed.createComponent(CycleCard);
  fixture.detectChanges();
  return fixture;
}

function nextMorning() {
  vi.setSystemTime(MORNING);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('CycleCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(EVENING);
  });
  afterEach(() => vi.useRealTimers());

  it('logs the day the button is pressed, not the day the tab was opened', () => {
    const added: string[] = [];
    const fixture = open([], added);
    nextMorning();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button.primary') as HTMLButtonElement).click();
    expect(added).toEqual(['2026-11-28']);
  });

  it('moves the count on when the tab comes back the next day', () => {
    const fixture = open(['2026-11-27']);
    expect(fixture.nativeElement.textContent).toContain('ngày 1');
    nextMorning();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ngày 2');
  });
});

import {cycleState} from './cycle';

const today = {year: 2026, month: 11, day: 27};

describe('cycleState', () => {
  it('has nothing to count before the first logged day', () => {
    expect(cycleState([], today)).toEqual({kind: 'none'});
  });

  it('assumes 28 days until there are two starts', () => {
    expect(cycleState(['2026-11-10'], today))
      .toEqual({kind: 'before', daysLeft: 11, next: {year: 2026, month: 12, day: 8}, length: 28});
  });

  it('averages recent gaps whatever the order, ignoring repeats and the gap of a forgotten log', () => {
    // Gaps of 29 and 31 days count; 124 days (a missed log) does not.
    expect(cycleState(['2026-09-02', '2026-11-01', '2026-05-01', '2026-10-03', '2026-11-01'], today))
      .toEqual({kind: 'before', daysLeft: 4, next: {year: 2026, month: 12, day: 1}, length: 30});
  });

  it('counts the day of the period for five days', () => {
    expect(cycleState(['2026-11-25'], today)).toMatchObject({kind: 'during', day: 3});
  });

  it('says how late it is after the predicted day', () => {
    expect(cycleState(['2026-10-20'], today)).toMatchObject({kind: 'late', lateBy: 10});
  });

  it('is due on the predicted day itself', () => {
    expect(cycleState(['2026-10-30'], today)).toMatchObject({kind: 'before', daysLeft: 0});
  });
});

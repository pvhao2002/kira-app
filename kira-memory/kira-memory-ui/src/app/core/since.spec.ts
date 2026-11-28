import {milestoneOn, nextMilestone, together, todayInVietnam} from './since';

describe('together', () => {
  it('counts from 14/06/2018', () => {
    expect(together({year: 2026, month: 11, day: 26})).toEqual({
      years: 8, months: 5, days: 12, totalDays: 3087, totalWeeks: 441, totalMonths: 101
    });
  });

  it('is zero on the first day and one year on the anniversary', () => {
    expect(together({year: 2018, month: 6, day: 14}).totalDays).toBe(0);
    const a = together({year: 2019, month: 6, day: 14});
    expect([a.years, a.months, a.days, a.totalDays, a.totalMonths]).toEqual([1, 0, 0, 365, 12]);
  });

  it('borrows days from the previous month', () => {
    // 14/06 -> 05/08: 1 month (to 14/07) + 22 days (July has 31).
    const t = together({year: 2018, month: 8, day: 5});
    expect([t.years, t.months, t.days, t.totalDays]).toEqual([0, 1, 22, 52]);
  });

  it('uses the Vietnam date, not the device date', () => {
    // 2026-11-25 18:00 UTC is already the 26th in Vietnam (UTC+7).
    expect(todayInVietnam(new Date('2026-11-25T18:00:00Z'))).toEqual({year: 2026, month: 11, day: 26});
  });
});

describe('milestones', () => {
  const on = (year: number, month: number, day: number) => milestoneOn({year, month, day});

  it('celebrates anniversaries, thousands and repdigit days big, hundreds medium, month-days small', () => {
    expect(on(2019, 6, 14)).toMatchObject({title: 'Tròn 1 năm bên nhau', tier: 'big', daysLeft: 0});
    expect(on(2026, 8, 31)).toMatchObject({title: 'Tròn 3.000 ngày bên nhau', tier: 'big'});
    expect(on(2026, 12, 9)).toMatchObject({title: 'Tròn 3.100 ngày bên nhau', tier: 'medium'});
    expect(on(2026, 12, 14)).toMatchObject({title: 'Tròn 102 tháng bên nhau', tier: 'small'});
    expect(on(2027, 7, 30)).toMatchObject({title: 'Ngày thứ 3.333 bên nhau', tier: 'big'});
    expect(on(2026, 11, 27)).toBeNull();
  });

  it('picks the biggest when two fall on one day', () => {
    // Day 4,444 is also the 14th of a month.
    expect(on(2030, 8, 14)).toMatchObject({title: 'Ngày thứ 4.444 bên nhau', tier: 'big'});
  });

  it('counts down to the next milestone strictly after today, skipping month-days', () => {
    expect(nextMilestone({year: 2026, month: 11, day: 27})).toEqual(
      {title: 'Tròn 3.100 ngày bên nhau', tier: 'medium', date: {year: 2026, month: 12, day: 9}, daysLeft: 12});
    expect(nextMilestone({year: 2026, month: 12, day: 9})).toMatchObject(
      {title: 'Tròn 3.200 ngày bên nhau', date: {year: 2027, month: 3, day: 19}, daysLeft: 100});
    expect(nextMilestone({year: 2027, month: 3, day: 19})).toMatchObject(
      {title: 'Tròn 9 năm bên nhau', tier: 'big', date: {year: 2027, month: 6, day: 14}, daysLeft: 87});
  });
});

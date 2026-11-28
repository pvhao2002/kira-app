export interface Together {
  years: number; months: number; days: number;
  totalDays: number; totalWeeks: number; totalMonths: number;
}

export const START = {year: 2018, month: 6, day: 14};

/** Today's calendar date in Vietnam, whatever the device time zone. */
export function todayInVietnam(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'})
    .formatToParts(now);
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return {year: get('year'), month: get('month'), day: get('day')};
}

export type Ymd = {year: number; month: number; day: number};

const utc = (d: Ymd) => Date.UTC(d.year, d.month - 1, d.day);

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: Ymd, to: Ymd): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export function addDays(d: Ymd, n: number): Ymd {
  const t = new Date(utc(d) + n * 86_400_000);
  return {year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate()};
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 2026-11-27, the form the API uses. */
export const isoDay = (d: Ymd) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;

export function parseDay(iso: string): Ymd {
  const [year, month, day] = iso.split('-').map(Number);
  return {year, month, day};
}

/** 27/11, or 27/11/2026 with the year. */
export const viDay = (d: Ymd, year = false) => `${pad(d.day)}/${pad(d.month)}${year ? '/' + d.year : ''}`;

/** Time since `start`: calendar breakdown (8 năm 5 tháng 12 ngày) plus running totals of days, weeks and months. */
export function together(today: Ymd, start: Ymd = START): Together {
  const totalDays = Math.max(0, daysBetween(start, today));
  let years = today.year - start.year;
  let months = today.month - start.month;
  let days = today.day - start.day;
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(today.year, today.month - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return {years: 0, months: 0, days: 0, totalDays: 0, totalWeeks: 0, totalMonths: 0};
  return {years, months, days, totalDays, totalWeeks: Math.floor(totalDays / 7), totalMonths: years * 12 + months};
}

export const fmt = (n: number) => n.toLocaleString('vi-VN');

export type Tier = 'small' | 'medium' | 'big';
export interface Milestone { title: string; tier: Tier; date: Ymd; daysLeft: number; }

/** 111, 2222, 3333…: every digit the same. */
const repdigit = (n: number) => n > 100 && /^(\d)\1+$/.test(String(n));

/** Today's milestone, or null. When several fall on one day the biggest wins. */
export function milestoneOn(today: Ymd, start: Ymd = START): Milestone | null {
  const t = together(today, start);
  const n = t.totalDays;
  const at = (title: string, tier: Tier): Milestone => ({title, tier, date: today, daysLeft: 0});
  if (n === 0) return null;
  if (t.years > 0 && t.months === 0 && t.days === 0) return at(`Tròn ${t.years} năm bên nhau`, 'big');
  if (n % 1000 === 0) return at(`Tròn ${fmt(n)} ngày bên nhau`, 'big');
  if (repdigit(n)) return at(`Ngày thứ ${fmt(n)} bên nhau`, 'big');
  if (n % 100 === 0) return at(`Tròn ${fmt(n)} ngày bên nhau`, 'medium');
  if (t.days === 0) return at(`Tròn ${t.totalMonths} tháng bên nhau`, 'small');
  return null;
}

/** The next milestone worth counting down to (not month-days), strictly after today. */
export function nextMilestone(today: Ymd, start: Ymd = START): Milestone {
  // Every 100 days is one, so this walks at most 100 days.
  for (let d = 1; ; d++) {
    const m = milestoneOn(addDays(today, d), start);
    if (m && m.tier !== 'small') return {...m, daysLeft: d};
  }
}

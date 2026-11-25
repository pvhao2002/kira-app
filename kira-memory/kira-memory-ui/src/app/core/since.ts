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

type Ymd = {year: number; month: number; day: number};

/** Time since `start`: calendar breakdown (8 năm 5 tháng 12 ngày) plus running totals of days, weeks and months. */
export function together(today: Ymd, start: Ymd = START): Together {
  const totalDays = Math.max(0, Math.round((Date.UTC(today.year, today.month - 1, today.day)
    - Date.UTC(start.year, start.month - 1, start.day)) / 86_400_000));
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

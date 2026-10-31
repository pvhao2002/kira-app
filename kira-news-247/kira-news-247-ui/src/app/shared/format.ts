import { Pipe, PipeTransform } from '@angular/core';
import { SITE } from '../core/site';

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: SITE.timeZone,
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const dateOnly = new Intl.DateTimeFormat('vi-VN', {
  timeZone: SITE.timeZone,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Absolute Vietnam time (relative "x phút trước" would differ between SSR and hydration). */
export function formatTime(epochMillis: bigint | number): string {
  return epochMillis ? dateTime.format(Number(epochMillis)) : '';
}

export function formatDay(date: Date): string {
  return dateOnly.format(date);
}

export function isoTime(epochMillis: bigint): string | undefined {
  return epochMillis ? new Date(Number(epochMillis)).toISOString() : undefined;
}

@Pipe({ name: 'vnTime' })
export class VnTimePipe implements PipeTransform {
  transform(epochMillis: bigint | number): string {
    return formatTime(epochMillis);
  }
}

import {Component, computed, HostListener, signal} from '@angular/core';
import {fmt, isoDay, milestoneOn, nextMilestone, todayInVietnam, together, viDay} from '../../core/since';
import {Celebration} from './celebration';

const SEEN_KEY = 'km-celebrated';

/** "Bên nhau": the days since 14/06/2018, the next milestone, and today's celebration (once a day on each device). */
@Component({
  selector: 'app-love-days',
  imports: [Celebration],
  template: `
    <h2><span aria-hidden="true">❤</span> Bên nhau</h2>
    <p class="head script">{{ fmt(t().totalDays) }} ngày</p>
    <p class="muted">{{ t().years }} năm {{ t().months }} tháng {{ t().days }} ngày</p>
    @if (today(); as m) {
      <p class="note">Hôm nay: {{ m.title }} 🎉
        <button class="btn ghost" type="button" (click)="playing.set(true)">Xem lại</button>
      </p>
      @if (playing()) { <app-celebration [milestone]="m" (closed)="playing.set(false)"/> }
    }
    <p class="next">Còn {{ next().daysLeft }} ngày nữa là {{ lowerFirst(next().title) }} ({{ viDay(next().date) }})</p>
  `,
  styles: `
    h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--mauve); }
    p { margin: 0; }
    .head { font-size: 34px; line-height: 1.15; color: var(--rose-deep); }
    .note { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; color: var(--rose-deep); font-weight: 600; }
    .note .btn { padding: 0 10px; }
    .next { margin-top: 6px; font-size: 14px; }
  `
})
export class LoveDays {
  private day = signal(todayInVietnam());
  protected t = computed(() => together(this.day()));
  protected today = computed(() => milestoneOn(this.day()));
  protected next = computed(() => nextMilestone(this.day()));
  protected playing = signal(false);
  protected fmt = fmt;
  protected viDay = viDay;
  protected lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

  constructor() {
    this.celebrate();
  }

  /** A tab left open overnight comes back on another day, maybe a milestone. */
  @HostListener('document:visibilitychange')
  protected refreshDay() {
    const day = todayInVietnam();
    if (isoDay(day) === isoDay(this.day())) return;
    this.day.set(day);
    this.celebrate();
  }

  private celebrate() {
    if (this.today() && !seenToday(isoDay(this.day()))) this.playing.set(true);
  }
}

/** Marks today as celebrated on this device; true when it already was. Storage can throw (private mode, blocked). */
function seenToday(day: string): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY) === day) return true;
    localStorage.setItem(SEEN_KEY, day);
  } catch {
    // Celebrate anyway.
  }
  return false;
}

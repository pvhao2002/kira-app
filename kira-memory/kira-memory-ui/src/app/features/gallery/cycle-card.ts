import {Component, computed, HostListener, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Observable} from 'rxjs';
import {Api, Cycle, errorMessage} from '../../core/api';
import {cycleState} from '../../core/cycle';
import {isoDay, parseDay, todayInVietnam, viDay} from '../../core/since';

/** "Ngày dâu của Em": counts down to her next period from the start days either of us logs. */
@Component({
  selector: 'app-cycle-card',
  imports: [FormsModule],
  template: `
    <h2><span aria-hidden="true">🍓</span> Ngày dâu của Em</h2>
    @if (starts(); as list) {
      <p class="head script">{{ text().head }}</p>
      <p class="muted">{{ text().detail }}</p>
      @if (soon()) { <p class="note">Sắp tới rồi, nhớ giữ ấm nha ❤</p> }
      <div class="actions">
        @if (state().kind !== 'during') {
          <button class="btn primary" type="button" [disabled]="busy()" (click)="logToday()">Hôm nay đến rồi</button>
        }
        <form (ngSubmit)="log(other)">
          <label class="sr-only" for="cycle-day">Ngày bắt đầu kỳ</label>
          <input id="cycle-day" class="input" type="date" name="day" min="2018-06-14" [max]="today()" [(ngModel)]="other">
          <button class="btn" type="submit" [disabled]="busy() || !other">Ghi ngày khác</button>
        </form>
      </div>
      @if (list.length) {
        <details>
          <summary>Các lần đã ghi</summary>
          <ul>
            @for (d of list; track d) {
              <li>{{ day(d) }}
                <button class="btn ghost" type="button" [disabled]="busy()" (click)="remove(d)" [attr.aria-label]="'Xoá ngày ' + day(d)">✕</button>
              </li>
            }
          </ul>
        </details>
      }
    } @else if (!error()) {
      <p class="muted">Đang mở lịch…</p>
    }
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
  `,
  styles: `
    h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--mauve); }
    p { margin: 0; }
    .head { font-size: 34px; line-height: 1.15; color: var(--rose-deep); }
    .note { color: var(--rose-deep); font-weight: 600; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    form { display: flex; gap: 8px; }
    .input { width: auto; padding: 6px 10px; }
    details { margin-top: 6px; font-size: 14px; }
    summary { cursor: pointer; color: var(--mauve); }
    ul { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 2px 14px; }
    li { display: flex; align-items: center; }
    li .btn { padding: 0 8px; }
  `
})
export class CycleCard {
  private api = inject(Api);
  protected today = signal(isoDay(todayInVietnam()));
  protected starts = signal<string[] | null>(null);
  protected state = computed(() => cycleState(this.starts() ?? [], parseDay(this.today())));
  protected soon = computed(() => {
    const s = this.state();
    return s.kind === 'before' && s.daysLeft <= 3;
  });
  protected text = computed(() => {
    const s = this.state();
    switch (s.kind) {
      case 'none':
        return {head: 'Chưa ghi ngày nào', detail: 'Ghi ngày bắt đầu kỳ gần nhất để mình đếm giúp nha.'};
      case 'during':
        return {head: `Đang trong kỳ · ngày ${s.day}`, detail: `Kỳ sau khoảng ${viDay(s.next)}`};
      case 'before':
        return {head: s.daysLeft ? `Còn ${s.daysLeft} ngày` : 'Có thể là hôm nay', detail: `Khoảng ${viDay(s.next)} · chu kỳ ~${s.length} ngày`};
      case 'late':
        return {head: `Trễ ${s.lateBy} ngày`, detail: `Dự kiến ${viDay(s.next)} · chu kỳ ~${s.length} ngày`};
    }
  });
  protected other = '';
  protected busy = signal(false);
  protected error = signal('');

  constructor() {
    this.api.cycle().subscribe({next: c => this.starts.set(c.starts), error: err => this.error.set(errorMessage(err))});
  }

  /** A tab left open overnight comes back on another day. */
  @HostListener('document:visibilitychange')
  protected refreshDay() {
    this.today.set(isoDay(todayInVietnam()));
  }

  protected logToday() {
    this.refreshDay();
    this.log(this.today());
  }

  protected log(day: string) {
    this.save(this.api.addCycleStart(day), () => (this.other = ''));
  }

  protected remove(day: string) {
    if (confirm(`Xoá ngày ${this.day(day)} khỏi lịch?`)) this.save(this.api.deleteCycleStart(day));
  }

  protected day = (iso: string) => viDay(parseDay(iso), true);

  private save(call: Observable<Cycle>, done?: () => void) {
    this.busy.set(true);
    this.error.set('');
    call.subscribe({
      next: c => {
        this.starts.set(c.starts);
        this.busy.set(false);
        done?.();
      },
      error: err => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      }
    });
  }
}

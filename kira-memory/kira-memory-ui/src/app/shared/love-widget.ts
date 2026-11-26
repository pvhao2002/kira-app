import {Component, computed, DestroyRef, effect, ElementRef, inject, signal, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {errorMessage, Message} from '../core/api';
import {AuthStore} from '../core/auth';
import {Live} from '../core/live';
import {shapeAt, SHAPES} from './shapes';

export interface MessageRow { message: Message; day: string | null; }

/** Each message, with a label on the first one of every local day: "Hôm nay", "Hôm qua" or the date. */
export function byDay(messages: Message[], now: number): MessageRow[] {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = key(new Date(now));
  const before = new Date(now);
  before.setDate(before.getDate() - 1);
  const yesterday = key(before);
  let last = '';
  return messages.map(message => {
    const d = new Date(message.createdAt);
    const k = key(d);
    const day = k === last ? null : k === today ? 'Hôm nay' : k === yesterday ? 'Hôm qua'
      : d.toLocaleDateString('vi-VN', {weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'});
    last = k;
    return {message, day};
  });
}

/** Bottom-right note box: its outline is the shape the admin picked; it opens the shared messages. */
@Component({
  selector: 'app-love-widget',
  imports: [FormsModule],
  template: `
    @if (live.panelOpen()) {
      <section class="panel" role="dialog" aria-label="Lời nhắn">
        <header>
          <h2 class="script">Lời nhắn cho nhau</h2>
          <button class="btn ghost close" type="button" (click)="live.open(false)" aria-label="Đóng">✕</button>
        </header>
        <ol class="list" #list aria-live="polite">
          @if (live.hasOlder()) {
            <li class="older">
              <button class="btn ghost" type="button" [disabled]="loadingOlder()" (click)="older()">
                {{ loadingOlder() ? 'Đang tải…' : 'Xem lời nhắn cũ hơn' }}
              </button>
            </li>
          }
          @for (row of rows(); track row.message.id) {
            @if (row.day) { <li class="day"><span>{{ row.day }}</span></li> }
            <li [class.mine]="row.message.author === me()">
              <p>{{ row.message.body }}</p>
              <small>{{ row.message.authorName }}, {{ time(row.message.createdAt) }}</small>
            </li>
          } @empty {
            <li class="empty">Chưa có lời nhắn nào. Viết điều đầu tiên đi.</li>
          }
        </ol>
        <form (ngSubmit)="send()">
          <label class="sr-only" for="msg">Lời nhắn</label>
          <textarea #input id="msg" class="input" name="body" rows="2" maxlength="2000" [(ngModel)]="draft"
                    placeholder="Viết gì đó cho người ấy…" (keydown.enter)="enter($event)"></textarea>
          <button class="btn primary" type="submit" [disabled]="sending() || !draft.trim()">Gửi</button>
        </form>
        @if (error()) { <p class="error">{{ error() }}</p> }
      </section>
    }
    <button class="fab" [class.turn]="turning()" (animationend)="turning.set(false)" type="button" (click)="live.open(!live.panelOpen())"
            [attr.aria-label]="live.unread() ? live.unread() + ' lời nhắn mới' : 'Mở lời nhắn'">
      <svg viewBox="0 0 64 64" aria-hidden="true"><path [attr.d]="path()"/></svg>
      @if (live.unread()) { <span class="badge" aria-hidden="true">{{ live.unread() }}</span> }
    </button>
    <span class="sr-only" role="status" aria-atomic="true">{{ live.unread() ? live.unread() + ' lời nhắn mới' : '' }}</span>
  `,
  styles: `
    :host { position: fixed; right: 20px; bottom: 20px; z-index: 50; display: grid; justify-items: end; gap: 12px; }
    .fab { position: relative; width: 68px; height: 68px; padding: 0; border: 0; background: none; cursor: pointer;
      filter: drop-shadow(0 6px 14px rgb(190 18 60 / .35)); transition: transform .15s; }
    .fab:hover { transform: scale(1.06); }
    .fab svg { width: 100%; height: 100%; }
    .fab path { fill: var(--rose); stroke: var(--paper); stroke-width: 2.5; stroke-linejoin: round; transition: opacity .3s; }
    .fab.turn path { animation: turn .5s ease; }
    @keyframes turn { 40% { opacity: 0; transform: scale(.6); transform-origin: center; } }
    .badge { position: absolute; top: -2px; right: -2px; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px;
      background: var(--wine); color: #fff; font-size: 12px; font-weight: 700; line-height: 22px; text-align: center; }
    .panel { width: min(360px, calc(100vw - 40px)); max-height: min(560px, calc(100vh - 130px)); display: flex; flex-direction: column;
      background: var(--paper); border: 1px solid var(--blush); border-radius: 22px; box-shadow: var(--shadow); overflow: hidden; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 4px 18px; }
    h2 { margin: 0; font-size: 26px; color: var(--rose-deep); }
    .close { width: 40px; padding: 0; }
    .list { flex: 1; overflow-y: auto; margin: 0; padding: 8px 16px; list-style: none; display: grid; gap: 10px; align-content: start; }
    .list li { max-width: 82%; justify-self: start; }
    .list li.mine { justify-self: end; text-align: right; }
    .list p { margin: 0; padding: 8px 13px; border-radius: 16px 16px 16px 4px; background: var(--petal); white-space: pre-wrap;
      overflow-wrap: anywhere; text-align: left; }
    .list li.mine p { background: var(--rose-deep); color: #fff; border-radius: 16px 16px 4px 16px; }
    .list small { font-size: 12px; color: var(--mauve); }
    .list .day { max-width: none; justify-self: stretch; display: flex; align-items: center; gap: 10px; margin-top: 4px;
      font-size: 12px; color: var(--mauve); }
    .list .day::before, .list .day::after { content: ''; flex: 1; border-top: 1px solid var(--blush); }
    .list .older { max-width: none; justify-self: center; }
    .list .empty { max-width: none; color: var(--mauve); text-align: center; justify-self: stretch; padding: 24px 0; }
    form { display: flex; gap: 8px; align-items: end; padding: 12px; border-top: 1px solid var(--blush); }
    textarea { min-height: 44px; resize: none; }
    .error { margin: 0 12px 10px; }
  `
})
export class LoveWidget {
  protected live = inject(Live);
  private auth = inject(AuthStore);
  private listEl = viewChild<ElementRef<HTMLElement>>('list');
  private inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('input');
  protected me = computed(() => this.auth.user()?.username);
  private now = signal(Date.now());
  protected turning = signal(false);
  protected path = computed(() => SHAPES[shapeAt(this.live.shape(), this.now())].path);
  protected rows = computed(() => byDay(this.live.messages(), this.now()));
  protected draft = '';
  protected sending = signal(false);
  protected loadingOlder = signal(false);
  protected error = signal('');
  /** Distance from the bottom of the list to restore once an older page is in. */
  private keepFromBottom: number | null = null;

  constructor() {
    // Keep the newest message in view; an older page goes on top without moving what the reader sees.
    let newest = 0;
    effect(() => {
      const last = this.live.messages().at(-1)?.id ?? 0;
      const appended = last !== newest;
      newest = last;
      const el = this.listEl()?.nativeElement;
      if (!el) return;
      const keep = this.keepFromBottom;
      this.keepFromBottom = null;
      queueMicrotask(() => (el.scrollTop = keep !== null && !appended ? el.scrollHeight - keep : el.scrollHeight));
    });
    // A short pop when the shape changes, so the change is noticed.
    let last = '';
    effect(() => {
      const d = this.path();
      if (last && d !== last) this.turning.set(true);
      last = d;
    });
    // Tick on each minute boundary so 'auto' changes shape exactly when the minute turns.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      this.now.set(Date.now());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    tick();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
    // Opening the box puts the cursor in the message field.
    effect(() => this.inputEl()?.nativeElement.focus());
  }

  protected enter(e: Event) {
    if (!(e as KeyboardEvent).shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  protected older() {
    const el = this.listEl()?.nativeElement;
    if (el) this.keepFromBottom = el.scrollHeight - el.scrollTop;
    this.loadingOlder.set(true);
    this.error.set('');
    this.live.loadOlder().subscribe({
      next: () => this.loadingOlder.set(false),
      error: err => {
        this.keepFromBottom = null;
        this.error.set(errorMessage(err, 'Không tải được lời nhắn cũ'));
        this.loadingOlder.set(false);
      }
    });
  }

  protected send() {
    const body = this.draft.trim();
    if (!body || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    this.live.send(body).subscribe({
      next: m => {
        this.live.add(m);
        this.draft = '';
        this.sending.set(false);
      },
      error: err => {
        this.error.set(errorMessage(err));
        this.sending.set(false);
      }
    });
  }

  protected time(iso: string) {
    // The day is on the separator above.
    return new Date(iso).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
  }
}

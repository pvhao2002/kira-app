import {Component, computed, DestroyRef, effect, ElementRef, inject, signal, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {errorMessage} from '../core/api';
import {AuthStore} from '../core/auth';
import {Live} from '../core/live';
import {shapeAt, SHAPES} from './shapes';

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
          @for (m of live.messages(); track m.id) {
            <li [class.mine]="m.author === me()">
              <p>{{ m.body }}</p>
              <small>{{ m.authorName }}, {{ time(m.createdAt) }}</small>
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
  protected draft = '';
  protected sending = signal(false);
  protected error = signal('');

  constructor() {
    // Keep the newest message in view.
    effect(() => {
      this.live.messages();
      const el = this.listEl()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
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
    return new Date(iso).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'});
  }
}

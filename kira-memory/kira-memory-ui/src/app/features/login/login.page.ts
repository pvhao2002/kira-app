import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {Api, errorMessage} from '../../core/api';
import {AuthStore} from '../../core/auth';
import {fmt, together, todayInVietnam} from '../../core/since';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  template: `
    <main class="page">
      <section class="banner" [class.has-photo]="photo()" [style.background-image]="photo() ? 'url(' + photo() + ')' : null">
        <div class="note">
          <h1>Đã bao nhiêu ngày, tuần, tháng, năm kể từ ngày 14/06/2018</h1>
          <dl class="counts">
            <div><dt>ngày</dt><dd class="script">{{ fmt(t.totalDays) }}</dd></div>
            <div><dt>tuần</dt><dd class="script">{{ fmt(t.totalWeeks) }}</dd></div>
            <div><dt>tháng</dt><dd class="script">{{ fmt(t.totalMonths) }}</dd></div>
            <div><dt>năm</dt><dd class="script">{{ t.years }}</dd></div>
          </dl>
          <p class="exact">Tức là {{ t.years }} năm {{ t.months }} tháng {{ t.days }} ngày mình bên nhau.</p>
        </div>
      </section>

      <section class="form-side">
        <form (ngSubmit)="submit()">
          <h2 class="script">Chào người thương</h2>
          <p class="muted">Nơi cất giữ ảnh và lời nhắn của hai đứa mình.</p>
          <label class="field">Tên đăng nhập
            <input class="input" name="username" autocomplete="username" required [(ngModel)]="username">
          </label>
          <label class="field">Mật khẩu
            <input class="input" name="password" type="password" autocomplete="current-password" required [(ngModel)]="password">
          </label>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <button class="btn primary" type="submit" [disabled]="busy() || !username || !password">
            {{ busy() ? 'Đang mở…' : 'Mở kỷ niệm' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: `
    .page { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(340px, 1fr); }
    .banner { position: relative; display: flex; align-items: flex-end; padding: clamp(24px, 5vw, 64px);
      background: var(--wine) center / cover no-repeat; color: #fff; isolation: isolate; overflow: hidden; }
    .banner::after { content: ''; position: absolute; inset: 0; z-index: -1;
      background: linear-gradient(180deg, rgb(91 15 35 / 0) 35%, rgb(91 15 35 / .82) 100%); }
    .banner:not(.has-photo)::before { content: '14.06.2018'; position: absolute; top: 8%; left: 6%; z-index: -1;
      font: 700 clamp(64px, 12vw, 180px)/1 var(--script); color: rgb(255 214 223 / .14); }
    .note { max-width: 640px; }
    h1 { margin: 0 0 18px; font-size: clamp(17px, 1.6vw, 21px); font-weight: 500; line-height: 1.4; max-width: 30ch; }
    .counts { display: flex; flex-wrap: wrap; gap: 8px 34px; margin: 0; }
    .counts div { display: flex; flex-direction: column-reverse; }
    dt { font-size: 14px; color: var(--blush); }
    dd { margin: 0; font-size: clamp(44px, 6vw, 80px); line-height: 1; }
    .exact { margin: 18px 0 0; font-size: 16px; color: var(--blush); }
    .form-side { display: grid; place-items: center; padding: 32px 20px; }
    form { width: min(360px, 100%); display: grid; gap: 16px; }
    h2 { margin: 0; font-size: 44px; line-height: 1.1; color: var(--rose-deep); }
    form > p { margin: -8px 0 6px; }
    .btn.primary { min-height: 46px; margin-top: 4px; }
    @media (max-width: 820px) {
      .page { grid-template-columns: 1fr; }
      .banner { min-height: 62vh; }
    }
    /* Phones: keep the login form close to the first screen. */
    @media (max-width: 560px) {
      .banner { min-height: 46vh; }
      h2 { font-size: 38px; }
    }
  `
})
export class LoginPage {
  private auth = inject(AuthStore);
  private router = inject(Router);
  protected t = together(todayInVietnam());
  protected fmt = fmt;
  protected photo = signal<string | null>(null);
  protected username = '';
  protected password = '';
  protected busy = signal(false);
  protected error = signal('');

  constructor() {
    inject(Api).loginBanner().subscribe({next: b => this.photo.set(b.imageUrl), error: () => undefined});
  }

  protected submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.username.trim(), this.password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: err => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      }
    });
  }
}

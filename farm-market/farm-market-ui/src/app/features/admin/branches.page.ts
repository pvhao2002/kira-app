import {ChangeDetectionStrategy, Component, computed, inject, resource} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {Api} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {errMsg} from './admin.data';

interface ApiBranch {
  id: number;
  code: string;
  name: string;
  address: string;
  hours: string;
  open: boolean;
  themePrimary: string;
  themeAccent: string;
  managerName: string | null;
  phone: string | null;
}

@Component({
  selector: 'app-branches-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">Chi nhánh</div>
        <h1 class="page-title">Chi nhánh</h1>
      </div>
    </header>

    <nav class="sub" aria-label="Chi nhánh">
      <a class="on" routerLink="/admin/branches" aria-current="page">Danh sách</a>
      @if (isAdmin()) {
        <a routerLink="/admin/branches/theme">Giao diện</a>
      }
    </nav>

    @if (res.error()) {
      <div class="state-box" role="alert"><b>{{ msg(res.error()) }}</b><button type="button" class="btn secondary" (click)="res.reload()">Thử lại</button></div>
    } @else if (!res.hasValue()) {
      <div class="state-box" role="status">Đang tải chi nhánh…</div>
    } @else if (cards().length) {
      <div class="cards">
        @for (c of cards(); track c.id) {
          <article class="card item" [class.cur]="c.i === store.index()">
            <div class="swatch" aria-hidden="true">
              <i class="p" [style.background]="c.p"></i><i class="a" [style.background]="c.a"></i>
            </div>
            <div class="top">
              <div><div class="name">{{ c.name }}</div><div class="muted small">{{ c.address }}</div></div>
              <span class="pill" [class]="c.open ? 'ok' : 'bad'">{{ c.open ? 'Đang mở cửa' : 'Tạm đóng' }}</span>
            </div>
            <dl class="kv">
              <dt class="muted">Giờ mở cửa</dt><dd>{{ c.hours }}</dd>
              <dt class="muted">Quản lý</dt><dd>{{ c.managerName || '—' }}</dd>
              <dt class="muted">Điện thoại</dt><dd>{{ c.phone || '—' }}</dd>
            </dl>
            <div class="row">
              <button type="button" class="btn secondary sm" (click)="manage(c.i)">Quản lý</button>
              @if (isAdmin()) {
                <button type="button" class="btn ghost sm" (click)="theme(c.i)">
                  <i class="dots"><i [style.background]="c.p"></i><i [style.background]="c.a"></i></i>Giao diện
                </button>
              }
            </div>
          </article>
        }
      </div>
    } @else {
      <div class="state-box">Bạn chưa được phân công chi nhánh nào.</div>
    }
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .sub { display: flex; gap: 6px; margin-bottom: 20px; }
    .sub a { padding: 8px 16px; border-radius: 999px; font-weight: 500; color: var(--muted); }
    .sub a.on { background: var(--ink); color: #fff; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .item { display: flex; flex-direction: column; gap: 14px; padding: 0 0 20px; overflow: hidden; }
    .item > :not(.swatch) { margin: 0 20px; }
    .item.cur { border: 1.5px solid var(--primary); }
    .swatch { position: relative; height: 56px; }
    .swatch .p { position: absolute; inset: 0; }
    .swatch .a { position: absolute; right: 0; bottom: 0; width: 80px; height: 14px; }
    .top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
    .name { font-weight: 600; font-size: 16px; }
    .small { font-size: 12px; }
    .kv { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin-top: 0; margin-bottom: 0; }
    .kv dd { margin: 0; text-align: right; }
        .dots { display: inline-flex; }
    .dots i { width: 10px; height: 10px; border-radius: 50%; border: 1px solid #fff; margin-right: -3px; }
    @media (max-width: 1100px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 767px) { .cards { grid-template-columns: 1fr; } }
  `
})
export class BranchesPage {
  readonly store = inject(BranchStore);
  private readonly api = inject(Api);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly isAdmin = computed(() => this.auth.user()?.role === 'admin');

  readonly res = resource({loader: () => this.api.get<ApiBranch[]>('/admin/branches')});
  readonly msg = errMsg;

  /** The API already returns only the caller's branches; index = id - 1 in BranchStore. */
  readonly cards = computed(() =>
    (this.res.hasValue() ? this.res.value() : []).map(b => ({...b, i: b.id - 1, p: b.themePrimary, a: b.themeAccent}))
  );

  manage(i: number): void {
    this.store.select(i);
    void this.router.navigate(['/admin']);
  }

  theme(i: number): void {
    this.store.select(i);
    void this.router.navigate(['/admin/branches/theme']);
  }
}

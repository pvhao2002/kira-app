import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {AA_RATIO, whiteContrast} from '../../core/contrast';
import {vnd} from '../../core/format';
import {ACCENT_PRESETS, PRIMARY_PRESETS} from '../../core/mock-data';
import {errMsg} from './admin.data';

@Component({
  selector: 'app-branch-theme-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">Chi nhánh / Giao diện</div>
        <h1 class="page-title">Màu thương hiệu theo chi nhánh</h1>
      </div>
      <div class="row wrap">
        <button type="button" class="btn secondary" (click)="store.resetTheme()">Khôi phục mặc định</button>
        <button type="button" class="btn" [disabled]="store.saved() || saving()" (click)="save()">{{ saving() ? 'Đang lưu…' : store.saved() ? 'Đã lưu' : 'Lưu thay đổi' }}</button>
      </div>
    </header>

    @if (err()) {<p class="errm" role="alert">{{ err() }}</p>}

    <nav class="sub" aria-label="Chi nhánh">
      <a routerLink="/admin/branches">Danh sách</a>
      <a class="on" routerLink="/admin/branches/theme" aria-current="page">Giao diện</a>
    </nav>

    <div class="layout">
      <section class="card cfg">
        <div class="list">
          <div class="eyebrow">{{ allowed().length }} chi nhánh</div>
          @for (i of allowed(); track i) {
            <button type="button" class="br" [class.on]="i === store.index()" (click)="pickBranch(i)">
              <span class="disc" aria-hidden="true">
                <i class="p" [style.background]="store.themeOf(i).primary"></i><i class="a" [style.background]="store.themeOf(i).accent"></i>
              </span>
              <span class="bt"><b>{{ store.branches[i].name }}</b><span class="muted small">{{ store.branches[i].addr }}</span></span>
            </button>
          }
        </div>

        <div class="edit">
          <h2 class="serif h">{{ store.current().name }}</h2>

          <div class="group">
            <b>Màu chủ đạo</b>
            <p class="muted small">Nút bấm, liên kết, thanh trên cùng, giá sản phẩm.</p>
            <div class="row wrap presets">
              @for (c of primaries; track c) {
                <button type="button" class="sw" [class.on]="c === store.theme().primary" [style.background]="c" [attr.aria-label]="'Màu chủ đạo ' + c" [attr.aria-pressed]="c === store.theme().primary" (click)="store.setTheme('primary', c)"></button>
              }
            </div>
            <div class="row">
              <input type="color" aria-label="Chọn màu chủ đạo" [value]="store.theme().primary" (input)="store.setTheme('primary', $any($event.target).value)">
              <span class="mono">{{ store.theme().primary }}</span>
            </div>
            @if (ok()) {
              <div class="note okn" role="status">Chữ trắng trên màu này: <b>{{ ratio() }}</b> · Đạt chuẩn dễ đọc (AA)</div>
            } @else {
              <div class="note badn" role="alert">Chữ trắng trên màu này: <b>{{ ratio() }}</b> · Quá sáng, chữ trên nút sẽ khó đọc. Chọn màu đậm hơn.</div>
            }
          </div>

          <div class="group">
            <b>Màu nhấn</b>
            <p class="muted small">Nhãn "Bán chạy", nút "Mua ngay", điểm nhấn trên nền màu chủ đạo.</p>
            <div class="row wrap presets">
              @for (c of accents; track c) {
                <button type="button" class="sw" [class.on]="c === store.theme().accent" [style.background]="c" [attr.aria-label]="'Màu nhấn ' + c" [attr.aria-pressed]="c === store.theme().accent" (click)="store.setTheme('accent', c)"></button>
              }
            </div>
            <div class="row">
              <input type="color" aria-label="Chọn màu nhấn" [value]="store.theme().accent" (input)="store.setTheme('accent', $any($event.target).value)">
              <span class="mono">{{ store.theme().accent }}</span>
            </div>
          </div>

          <div class="group">
            <b>Màu tự sinh</b>
            <div class="gen">
              <div><i class="chip" style="background: var(--primary)"></i>Chủ đạo</div>
              <div><i class="chip" style="background: var(--primary-dark)"></i>Hover</div>
              <div><i class="chip" style="background: var(--tint)"></i>Nền nhạt</div>
              <div><i class="chip" style="background: var(--accent)"></i>Nhấn</div>
            </div>
          </div>
        </div>
      </section>

      <section class="card prev">
        <div class="eyebrow">Xem trước</div>
        <div class="shop" aria-label="Xem trước cửa hàng">
          <div class="top"><span>Mua tại: <b>{{ store.current().name }}</b></span><span>1900 6868</span></div>
          <div class="nav"><span class="logo serif"><i class="egg"></i>Đồi Nắng</span><span class="cart">Giỏ hàng · 3</span></div>
          <div class="hero">
            <div class="serif hl">Thực phẩm tươi sạch từ <i>nông trại</i></div>
            <div class="row"><span class="btn accent sm">Mua ngay</span><span class="btn secondary sm">Khám phá</span></div>
          </div>
          <div class="prods">
            <div class="p">
              <div class="img"><span class="badge">Bán chạy</span></div>
              <div class="pn">Trứng gà ta – 10 quả</div>
              <div class="row between"><b class="price">{{ money(45000) }}</b><span class="plus">+</span></div>
            </div>
            <div class="p">
              <div class="img"></div>
              <div class="pn">Gà ta thả vườn</div>
              <div class="row between"><b class="price">{{ money(189000) }}</b><span class="plus">+</span></div>
            </div>
          </div>
          <div class="free">Thêm <b>{{ money(64000) }}</b> để được miễn phí giao hàng</div>
        </div>
        <p class="muted small">Thay đổi áp dụng ngay cho toàn bộ giao diện. Bấm "Lưu thay đổi" để lưu cho chi nhánh này.</p>
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .sub { display: flex; gap: 6px; margin-bottom: 20px; }
    .sub a { padding: 8px 16px; border-radius: 999px; font-weight: 500; color: var(--muted); }
    .sub a.on { background: var(--ink); color: #fff; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 20px; align-items: start; }
    .cfg { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; }
    .small { font-size: 12px; }
    .errm { color: var(--danger); margin: 0 0 12px; }
    .list { display: flex; flex-direction: column; gap: 8px; }
    .br { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: transparent; border: 1px solid var(--border); text-align: left; }
    .br.on { background: var(--surface); border: 1.5px solid var(--primary); }
    .disc { position: relative; width: 36px; height: 36px; flex: none; }
    .disc .p { position: absolute; inset: 0; border-radius: 50%; }
    .disc .a { position: absolute; right: -3px; bottom: -3px; width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--surface); }
    .bt { display: flex; flex-direction: column; min-width: 0; font-size: 13px; }
    .bt .small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .edit { display: flex; flex-direction: column; gap: 22px; }
    .h { font-size: 24px; margin: 0; }
    .group { display: flex; flex-direction: column; gap: 10px; }
    .presets { gap: 10px; }
    .sw { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line); padding: 0; }
    .sw.on { box-shadow: 0 0 0 2px var(--ink); }
    input[type=color] { width: 44px; height: 36px; border: 1px solid var(--line); border-radius: 8px; padding: 2px; background: var(--surface); }
    .note { padding: 10px 14px; border-radius: 12px; font-size: 13px; }
    .okn { background: var(--tint); color: var(--primary); }
    .badn { background: var(--danger-bg); color: var(--danger); }
    .gen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px; }
    .gen > div { display: flex; flex-direction: column; gap: 6px; }
    .chip { display: block; height: 36px; border-radius: 10px; border: 1px solid var(--line); }
    .prev { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 16px; }
    .shop { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--canvas); font-size: 12px; }
    .top { display: flex; justify-content: space-between; padding: 8px 14px; background: var(--primary); color: #fff; }
    .nav { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface); }
    .logo { display: flex; align-items: center; gap: 8px; font-size: 18px; }
    .egg { width: 14px; height: 17px; background: var(--primary); border-radius: 50% 50% 46% 46% / 60% 60% 40% 40%; }
    .cart { padding: 5px 12px; border-radius: 999px; background: var(--tint); color: var(--primary); font-weight: 600; }
    .hero { padding: 22px 14px; background: var(--primary); color: #fff; display: flex; flex-direction: column; gap: 14px; }
    .hl { font-size: 24px; line-height: 1.15; }
    .hl i { color: var(--accent); }
    .hero .btn.secondary { background: transparent; color: #fff; border-color: rgba(255, 255, 255, .5); }
    .prods { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px; }
    .p { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .img { position: relative; height: 70px; border-radius: 8px; background: var(--tint); }
    .badge { position: absolute; top: 6px; left: 6px; padding: 2px 8px; border-radius: 999px; background: var(--accent); color: var(--brown-dark); font-weight: 700; font-size: 10px; }
    .between { justify-content: space-between; }
    .price { color: var(--primary); }
    .plus { width: 22px; height: 22px; border-radius: 50%; background: var(--primary); color: #fff; display: grid; place-items: center; }
    .free { padding: 10px 14px; background: var(--tint); color: var(--primary); }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .prev { position: static; } }
    @media (max-width: 767px) { .cfg { grid-template-columns: 1fr; } }
  `
})
export class BranchThemePage {
  readonly store = inject(BranchStore);
  private readonly auth = inject(AuthStore);

  readonly primaries = PRIMARY_PRESETS;
  readonly accents = ACCENT_PRESETS;
  readonly money = vnd;
  readonly allowed = computed(() => this.auth.allowedBranches());
  readonly saving = signal(false);
  readonly err = signal('');

  pickBranch(i: number): void {
    this.store.select(i);
    this.err.set('');
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.err.set('');
    try {
      await this.store.saveTheme();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.saving.set(false);
    }
  }

  private readonly contrast = computed(() => whiteContrast(this.store.theme().primary));
  readonly ok = computed(() => this.contrast() >= AA_RATIO);
  readonly ratio = computed(() => this.contrast().toFixed(1).replace('.', ',') + ':1');
}

import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {Api} from '../../core/api';
import {num, vnd} from '../../core/format';
import {LoyaltySummary, Page, PointEntry, RewardDto, VoucherDto, errMsg, fmtDate} from './account.data';

const TABS: [string, string][] = [['Tất cả', 'all'], ['Nhận', 'earn'], ['Dùng', 'spend']];
const REASON: Record<string, string> = {
  PURCHASE: 'Mua hàng', REVIEW: 'Đánh giá sản phẩm', REDEEM: 'Đổi ưu đãi', REDEMPTION: 'Đổi ưu đãi', ORDER_SPEND: 'Dùng điểm cho đơn',
  REFUND: 'Hoàn điểm', EXPIRY: 'Điểm hết hạn', BIRTHDAY: 'Thưởng sinh nhật',
  CHECKOUT: 'Dùng điểm cho đơn', REWARD: 'Đổi ưu đãi', ORDER_CANCEL_REFUND: 'Hoàn điểm do hủy đơn', DEV_GRANT: 'Điểm tặng (dev)'
};

@Component({
  selector: 'app-rewards-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="page-title">Điểm thưởng</h1>
    @if (error()) { <div class="msg err" role="alert">{{ error() }} <button type="button" class="btn sm" (click)="reload()">Thử lại</button></div> }
    @if (notice(); as n) { <div class="msg" [class.err]="noticeErr()" role="status">{{ n }}</div> }

    @if (sum(); as s) {
    <section class="top">
      <div class="hero">
        <div class="row"><span>Điểm hiện có</span><span class="spacer"></span><span class="pill accent">Hạng {{ s.tier.label }}</span></div>
        <div class="big serif">{{ num(s.balance) }} <small>điểm</small></div>
        <div class="note">1 điểm = {{ vnd(s.pointValueVnd) }} khi thanh toán@if (s.expiringSoonPoints) { · {{ num(s.expiringSoonPoints) }} điểm hết hạn ngày {{ date(s.expiringSoonAt) }} }</div>
        <div class="tiers">
          <div class="tier cur"><div class="seg"></div><div class="tn">{{ s.tier.label }}</div><div class="tm">từ {{ num(s.tier.minPoints) }} điểm</div></div>
          @if (s.nextTier; as n) {
            <div class="tier off"><div class="seg"></div><div class="tn">{{ n.label }}</div><div class="tm">từ {{ num(n.minPoints) }} điểm · còn {{ num(s.pointsToNextTier) }}</div></div>
          }
        </div>
      </div>
      <div class="card">
        <h2>Quyền lợi hạng {{ s.tier.label }}</h2>
        @for (p of s.tier.perks; track p) { <div class="perk"><span class="tick">✓</span><span>{{ p }}</span></div> }
        @if (s.nextTier; as n) {
          <div class="muted next">Lên {{ n.label }} khi đạt {{ num(n.minPoints) }} điểm tích lũy trong năm (hiện có {{ num(s.yearPoints) }}).
            Quyền lợi: {{ n.perks.join('; ') }}</div>
        }
      </div>
    </section>
    } @else if (loading()) {
      <div class="state-box">Đang tải…</div>
    }

    <div class="row sec"><h2>Đổi điểm lấy ưu đãi</h2><span class="spacer"></span><span class="pill ok">{{ availableVouchers() }} mã đang có</span></div>
    <div class="rewards">
      @for (r of rewards(); track r.id) {
        <div class="card rw">
          <div class="serif rv">{{ r.title }}</div>
          <div class="muted">{{ r.minOrder ? 'Cho đơn từ ' + vnd(r.minOrder) : 'Không yêu cầu đơn tối thiểu' }} · hạn {{ r.validDays }} ngày</div>
          <div class="row foot">
            <span class="muted">{{ num(r.pointsCost) }} điểm</span><span class="spacer"></span>
            <button type="button" class="btn sm" [class.secondary]="!canRedeem(r)" [disabled]="!canRedeem(r)" (click)="redeem(r)">{{ redeemingId() === r.id ? 'Đang đổi…' : 'Đổi' }}</button>
          </div>
        </div>
      }
    </div>

    @if (vouchers().length) {
      <div class="card hist vch">
        <h2>Mã giảm giá của tôi</h2>
        @for (v of vouchers(); track v.id) {
          <div class="row hrow">
            <div class="grow"><div><b>{{ v.code }}</b> · {{ v.title }}</div><div class="muted">Hết hạn {{ date(v.expiresAt) }}</div></div>
            <span class="pill" [class.ok]="v.status === 'AVAILABLE'">{{ v.status === 'AVAILABLE' ? 'Dùng được' : v.status === 'USED' ? 'Đã dùng' : 'Hết hạn' }}</span>
          </div>
        }
      </div>
    }

    <div class="card hist">
      <div class="row wrap"><h2>Lịch sử điểm</h2><span class="spacer"></span>
        @for (t of tabs; track t[1]) {
          <button type="button" class="tab-pill" [class.on]="tab() === t[1]" (click)="tab.set(t[1])">{{ t[0] }}</button>
        }
      </div>
      @for (h of history(); track h.id) {
        <div class="row hrow">
          <span class="sign" [class.neg]="h.delta < 0">{{ h.delta > 0 ? '+' : '−' }}</span>
          <div class="grow"><div>{{ desc(h) }}</div><div class="muted">{{ date(h.createdAt) }}</div></div>
          <b [class.negt]="h.delta < 0">{{ h.delta > 0 ? '+' : '−' }}{{ Math.abs(h.delta) }}</b>
        </div>
      } @empty {
        <div class="state-box">{{ loading() ? 'Đang tải…' : 'Chưa có giao dịch điểm.' }}</div>
      }
      @if (page() + 1 < totalPages()) {
        <button type="button" class="btn secondary sm more" (click)="more()">Xem thêm</button>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    h2 { font-size: 16px; font-weight: 600; }
    .msg { font-size: 13px; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); margin-bottom: 16px; }
    .msg.err { color: var(--danger); background: var(--danger-bg); }
    .top { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; margin: 24px 0; }
    .hero { background: var(--primary); color: #fff; border-radius: 18px; padding: 24px; display: flex; flex-direction: column; gap: 10px; }
    .big { font-size: 48px; line-height: 1.1; }
    .big small { font-size: 16px; opacity: .7; font-family: var(--sans); }
    .note { font-size: 13px; opacity: .85; }
    .tiers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px; }
    .seg { height: 6px; border-radius: 999px; background: var(--accent); margin-bottom: 6px; }
    .off .seg { background: rgba(255, 255, 255, .2); }
    .off { opacity: .7; }
    .tn { font-size: 13px; } .tm { font-size: 11px; opacity: .7; }
    .cur .tn { font-weight: 700; }
    .perk { display: flex; gap: 10px; padding: 8px 0; font-size: 13px; }
    .tick { color: var(--primary); font-weight: 700; }
    .next { font-size: 12px; margin-top: 8px; }
    .sec { margin-bottom: 14px; }
    .rewards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .rw { display: flex; flex-direction: column; gap: 6px; }
    .rv { font-size: 22px; color: var(--primary); }
    .foot { margin-top: auto; padding-top: 10px; }
    .hist { display: flex; flex-direction: column; gap: 6px; }
    .vch { margin-bottom: 24px; }
    .hrow { padding: 10px 0; border-top: 1px solid var(--border); }
    .grow { flex: 1; min-width: 0; }
    .more { align-self: center; margin-top: 8px; }
    .sign { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--tint); color: var(--primary); font-weight: 700; flex: none; }
    .sign.neg { background: var(--danger-bg); color: var(--danger); }
    .negt { color: var(--danger); }
    @media (max-width: 1100px) { .top { grid-template-columns: 1fr; } }
    @media (max-width: 767px) { .big { font-size: 38px; } }
  `
})
export class RewardsPage {
  private readonly api = inject(Api);
  protected readonly num = num;
  protected readonly vnd = vnd;
  protected readonly date = fmtDate;
  protected readonly Math = Math;
  protected readonly tabs = TABS;
  protected readonly tab = signal('all');
  protected readonly sum = signal<LoyaltySummary | null>(null);
  protected readonly rewards = signal<RewardDto[]>([]);
  protected readonly vouchers = signal<VoucherDto[]>([]);
  protected readonly history = signal<PointEntry[]>([]);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly noticeErr = signal(false);
  protected readonly redeemingId = signal('');

  protected readonly availableVouchers = computed(() => this.vouchers().filter(v => v.status === 'AVAILABLE').length);

  constructor() {
    void this.reload();
    effect(() => {
      this.tab();
      untracked(() => void this.loadHistory(0));
    });
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [s, r, v] = await Promise.all([
        this.api.get<LoyaltySummary>('/loyalty/summary'),
        this.api.get<RewardDto[]>('/loyalty/rewards'),
        this.api.get<VoucherDto[]>('/loyalty/vouchers')
      ]);
      this.sum.set(s);
      this.rewards.set(r);
      this.vouchers.set(v);
    } catch (e) {
      this.error.set(errMsg(e));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadHistory(page: number): Promise<void> {
    try {
      const r = await this.api.get<Page<PointEntry>>('/loyalty/history', {type: this.tab(), page, size: 20});
      this.history.update(h => (page === 0 ? r.data : [...h, ...r.data]));
      this.page.set(r.meta.page);
      this.totalPages.set(r.meta.totalPages);
    } catch (e) {
      this.error.set(errMsg(e));
    }
  }

  protected more(): void {
    void this.loadHistory(this.page() + 1);
  }

  protected desc = (h: PointEntry): string => (REASON[h.reason] ?? h.reason) + (h.refType === 'ORDER' && h.refId ? ' · đơn ' + h.refId : '');
  protected canRedeem = (r: RewardDto): boolean => !this.redeemingId() && (this.sum()?.balance ?? 0) >= r.pointsCost;

  /** A fresh Idempotency-Key per click attempt; the button is disabled while a redeem is in flight. */
  protected async redeem(r: RewardDto): Promise<void> {
    if (!this.canRedeem(r)) return;
    this.redeemingId.set(r.id);
    this.notice.set('');
    try {
      const v = await this.api.post<VoucherDto>('/loyalty/rewards/' + encodeURIComponent(r.id) + '/redeem', {}, crypto.randomUUID());
      this.noticeErr.set(false);
      this.notice.set(`Đã đổi "${r.title}". Mã của bạn: ${v.code}`);
      await Promise.all([this.reload(), this.loadHistory(0)]);
    } catch (e) {
      this.noticeErr.set(true);
      this.notice.set(errMsg(e));
    } finally {
      this.redeemingId.set('');
    }
  }
}

import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {Api, apiResource} from '../../core/api';
import {num} from '../../core/format';
import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {LoyaltySummary, Page, PointEntry, RewardDto, VoucherDto, errMsg, fmtDate, isFirstLoad, resErr, valueOr} from './account.data';

const TABS: [string, string][] = [['Tất cả', 'all'], ['Nhận', 'earn'], ['Dùng', 'spend']];
const REASON: Record<string, string> = {
  PURCHASE: 'Mua hàng', REVIEW: 'Đánh giá sản phẩm', REDEEM: 'Đổi ưu đãi', REDEMPTION: 'Đổi ưu đãi', ORDER_SPEND: 'Dùng điểm cho đơn',
  REFUND: 'Hoàn điểm', EXPIRY: 'Điểm hết hạn', BIRTHDAY: 'Thưởng sinh nhật',
  CHECKOUT: 'Dùng điểm cho đơn', REWARD: 'Đổi ưu đãi', ORDER_CANCEL_REFUND: 'Hoàn điểm do hủy đơn', DEV_GRANT: 'Điểm tặng (dev)'
};

@Component({
  selector: 'app-rewards-page',
  imports: [StateBox, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rewards.page.html',
  styleUrl: './rewards.page.css'
})
export class RewardsPage {
  private readonly api = inject(Api);
  protected readonly num = num;
  protected readonly date = fmtDate;
  protected readonly tabs = TABS;
  protected readonly tab = signal('all');
  private readonly sumRes = apiResource<LoyaltySummary>(() => ({path: '/loyalty/summary'}));
  private readonly rewardsRes = apiResource<RewardDto[]>(() => ({path: '/loyalty/rewards'}));
  private readonly vouchersRes = apiResource<VoucherDto[]>(() => ({path: '/loyalty/vouchers'}));
  /** page of the history to fetch; reset to 0 when the type changes */
  private readonly histPage = signal(0);
  private readonly histRes = apiResource<Page<PointEntry>>(() => ({path: '/loyalty/history', params: {type: this.tab(), page: this.histPage(), size: 20}}));
  protected readonly sum = computed(() => valueOr(this.sumRes, null));
  protected readonly rewards = computed(() => valueOr(this.rewardsRes, []));
  protected readonly vouchers = computed(() => valueOr(this.vouchersRes, []));
  /** pages fetched so far: "Xem thêm" appends, page 0 replaces */
  protected readonly history = signal<PointEntry[]>([]);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly loading = computed(() => isFirstLoad(this.sumRes) || isFirstLoad(this.rewardsRes) || isFirstLoad(this.vouchersRes));
  protected readonly histLoading = computed(() => isFirstLoad(this.histRes));
  protected readonly moreBusy = computed(() => this.histRes.isLoading());
  protected readonly error = computed(() => resErr(this.sumRes) || resErr(this.rewardsRes) || resErr(this.vouchersRes) || resErr(this.histRes));
  protected readonly notice = signal('');
  protected readonly noticeErr = signal(false);
  protected readonly redeemingId = signal('');

  protected readonly availableVouchers = computed(() => this.vouchers().filter(v => v.status === 'AVAILABLE').length);

  protected readonly rewardRows = computed(() => {
    const balance = this.sum()?.balance ?? 0;
    const busy = !!this.redeemingId();
    return this.rewards().map(r => ({r, can: !busy && balance >= r.pointsCost}));
  });
  protected readonly historyRows = computed(() => this.history().map(h => ({
    h,
    desc: (REASON[h.reason] ?? h.reason) + (h.refType === 'ORDER' && h.refId ? ' · đơn ' + h.refId : ''),
    abs: Math.abs(h.delta)
  })));

  constructor() {
    effect(() => {
      if (!this.histRes.hasValue()) return;
      const r = this.histRes.value();
      untracked(() => {
        this.history.update(h => (r.meta.page === 0 ? r.data : [...h, ...r.data]));
        this.page.set(r.meta.page);
        this.totalPages.set(r.meta.totalPages);
      });
    });
  }

  protected setTab(t: string): void {
    this.histPage.set(0);
    this.tab.set(t);
  }

  protected reload(): void {
    this.sumRes.reload();
    this.rewardsRes.reload();
    this.vouchersRes.reload();
    if (this.histPage() === 0) this.histRes.reload();
    else this.histPage.set(0);
  }

  protected more(): void {
    if (!this.moreBusy()) this.histPage.set(this.page() + 1);
  }

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
      this.reload();
    } catch (e) {
      this.noticeErr.set(true);
      this.notice.set(errMsg(e));
    } finally {
      this.redeemingId.set('');
    }
  }
}

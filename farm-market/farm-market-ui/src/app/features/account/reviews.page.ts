import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {Api, ApiError, apiResource} from '../../core/api';
import {ImageSlot} from '../../shared/image-slot';
import {StateBox} from '../../shared/state-box';
import {Stars} from '../../shared/stars';
import {MyReviewDto, Page, PendingReviewDto, REVIEW_LABELS, errMsg, fmtDate, isFirstLoad, resErr, valueOr} from './account.data';

interface Draft {
  rating: number;
  text: string;
  /** https:// link; the backend awards +50 instead of +20 when present */
  photoUrl: string;
  sending: boolean;
  error: string;
}

const key = (r: PendingReviewDto): string => `${r.orderId}-${r.productId}`;
const blank = (): Draft => ({rating: 0, text: '', photoUrl: '', sending: false, error: ''});

@Component({
  selector: 'app-reviews-page',
  imports: [ImageSlot, Stars, StateBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reviews.page.html',
  styleUrl: './reviews.page.css'
})
export class ReviewsPage {
  private readonly api = inject(Api);
  protected readonly labels = REVIEW_LABELS;
  protected readonly five = [1, 2, 3, 4, 5];
  protected readonly date = fmtDate;
  protected readonly keyOf = key;
  protected readonly tab = signal(0);
  private readonly pendingRes = apiResource<PendingReviewDto[]>(() => ({path: '/reviews/pending'}));
  private readonly mineRes = apiResource<Page<MyReviewDto>>(() => ({path: '/reviews/mine', params: {page: 0, size: 50}}));
  protected readonly pending = computed(() => valueOr(this.pendingRes, []));
  protected readonly done = computed(() => valueOr(this.mineRes, null)?.data ?? []);
  protected readonly doneTotal = computed(() => valueOr(this.mineRes, null)?.meta.totalElements ?? 0);
  protected readonly drafts = signal<Record<string, Draft>>({});
  protected readonly loading = computed(() => isFirstLoad(this.pendingRes) || isFirstLoad(this.mineRes));
  protected readonly error = computed(() => resErr(this.pendingRes) || resErr(this.mineRes));
  /** points awarded by the API for reviews sent in this visit */
  protected readonly earned = signal(0);

  constructor() {
    // one draft per pending review, kept across reloads
    effect(() => {
      const p = this.pending();
      untracked(() => this.drafts.update(d => Object.fromEntries(p.map(r => [key(r), d[key(r)] ?? blank()]))));
    });
  }

  protected reload(): void {
    this.pendingRes.reload();
    this.mineRes.reload();
  }

  protected patch(r: PendingReviewDto, p: Partial<Draft>): void {
    this.drafts.update(all => ({...all, [key(r)]: {...all[key(r)], ...p}}));
  }

  protected async submit(r: PendingReviewDto): Promise<void> {
    const d = this.drafts()[key(r)];
    if (!d?.rating || d.sending) return;
    this.patch(r, {sending: true, error: ''});
    try {
      const res = await this.api.post<MyReviewDto>('/reviews', {
        orderId: r.orderId, productId: r.productId, rating: d.rating,
        body: d.text.trim() || null, photoUrl: d.photoUrl.trim() || null
      });
      this.earned.update(n => n + res.pointsAwarded);
      this.reload();
    } catch (e) {
      const err = e as ApiError;
      this.patch(r, {sending: false, error: err.fieldErrors?.['photoUrl'] ?? errMsg(e)});
    }
  }
}

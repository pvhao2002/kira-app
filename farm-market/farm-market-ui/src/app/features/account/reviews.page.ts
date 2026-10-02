import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {Api, ApiError, apiResource} from '../../core/api';
import {ImageSlot} from '../../shared/image-slot';
import {StateBox} from '../../shared/state-box';
import {Stars} from '../../shared/stars';
import {MyReviewDto, Page, PendingReviewDto, REVIEW_LABELS, errMsg, fmtDate, isFirstLoad, resErr, valueOr} from './account.data';

interface Draft {
  rating: number;
  text: string;
  /** URL returned by POST /media/reviews; the backend awards +50 instead of +20 when present */
  photoUrl: string;
  uploading: boolean;
  sending: boolean;
  error: string;
}

const key = (r: PendingReviewDto): string => `${r.orderId}-${r.productId}`;
const blank = (): Draft => ({rating: 0, text: '', photoUrl: '', uploading: false, sending: false, error: ''});
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

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
    // a draft removed by a reload while an upload/submit was in flight must not be recreated half-empty
    this.drafts.update(all => all[key(r)] ? {...all, [key(r)]: {...all[key(r)], ...p}} : all);
  }

  protected async pickPhoto(r: PendingReviewDto, input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    const d = this.drafts()[key(r)];
    if (!file || !d || d.uploading) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      this.patch(r, {error: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.'});
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      this.patch(r, {error: 'Ảnh tối đa 5MB.'});
      return;
    }
    this.patch(r, {uploading: true, error: ''});
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await this.api.postForm<{url: string}>('/media/reviews', form);
      this.patch(r, {photoUrl: res.url});
    } catch (e) {
      this.patch(r, {error: errMsg(e)});
    } finally {
      this.patch(r, {uploading: false});
    }
  }

  protected removePhoto(r: PendingReviewDto): void {
    this.patch(r, {photoUrl: '', error: ''});
  }

  protected async submit(r: PendingReviewDto): Promise<void> {
    const d = this.drafts()[key(r)];
    if (!d?.rating || d.sending || d.uploading) return;
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

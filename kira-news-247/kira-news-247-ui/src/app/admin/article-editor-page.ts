import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { firstValueFrom } from 'rxjs';
import { errorMessage, ProtoApi, protoResource } from '../core/proto-api';
import { AuthStore } from '../core/auth-store';
import {
  AdminArticleSchema,
  ArticleDraftSchema,
  ArticleStatus,
  CategoryListSchema,
  CommentRequestSchema,
  ResolveCommentRequestSchema,
  RevisionSchema,
  Role,
  TransitionRequestSchema,
  WorkflowAction,
  type AdminArticle,
  type Revision,
} from '../gen/kira/news/v1/news_pb';
import { VnTimePipe } from '../shared/format';
import { parseQuickPaste } from './front-matter';
import { ACTION_ID, ACTION_LABEL, STATUS_CLASS, STATUS_LABEL } from './labels';

/** Create, edit and review one article. Every control has a stable data-testid for the computer-use agent. */
@Component({
  selector: 'news-article-editor-page',
  imports: [FormsModule, RouterLink, HlmButton, HlmInput, HlmLabel, HlmTextarea, VnTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = article.data();
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <a routerLink="/admin/bai-viet" class="text-sm text-muted-foreground hover:text-foreground">← Danh sách bài</a>
        <h1 class="mt-1 font-serif text-2xl font-bold">{{ a ? (a.draft?.title || 'Bài viết') : 'Viết bài mới' }}</h1>
        @if (a) {
          <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span data-testid="article-status" [attr.data-status]="statusName(a.status)"
                  [class]="'rounded-full px-2 py-0.5 text-xs font-medium ' + statusClass[a.status]">{{ statusLabel[a.status] }}</span>
            <span>#{{ a.id }} · bản {{ a.revision }} · tạo bởi {{ a.createdBy }} · cập nhật {{ a.updatedAt | vnTime }}</span>
            @if (a.status === published) {
              <a [routerLink]="['/tin', a.draft?.slug]" target="_blank" class="text-link hover:underline">Xem trên trang báo ↗</a>
            }
          </p>
        }
      </div>
    </div>

    <div aria-live="polite" class="mt-3">
      @if (notice()) { <p class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900" data-testid="notice">{{ notice() }}</p> }
      @if (error()) { <p role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900" data-testid="error">{{ error() }}</p> }
    </div>

    <div class="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <!-- ===== Content ===== -->
      <section class="min-w-0 rounded-xl border border-border bg-card p-4 md:p-6" aria-label="Nội dung bài">
        @if (editable()) {
          <details class="mb-6 rounded-lg border border-dashed border-border p-3" [open]="!a" data-testid="quick-paste-panel">
            <summary class="cursor-pointer text-sm font-semibold">Dán nhanh (front-matter + Markdown)</summary>
            <p class="mt-2 text-xs text-muted-foreground">Dán một khối theo mẫu ở trang “Hướng dẫn AI”, rồi bấm “Điền vào form”. Các trường có trong khối sẽ ghi đè form.</p>
            <textarea hlmTextarea class="mt-2 min-h-40 w-full font-mono text-xs" data-testid="quick-paste" aria-label="Khối dán nhanh"
                      [(ngModel)]="quickPaste"></textarea>
            <button hlmBtn variant="secondary" size="sm" class="mt-2" type="button" data-testid="quick-paste-apply" (click)="applyQuickPaste()">Điền vào form</button>
          </details>

          <form class="grid gap-4" (ngSubmit)="save()" data-testid="article-form">
            <div class="grid gap-1.5">
              <label hlmLabel for="f-title">Tiêu đề *</label>
              <input hlmInput id="f-title" name="title" required maxlength="300" data-testid="field-title" [(ngModel)]="title" />
            </div>
            <div class="grid gap-1.5">
              <label hlmLabel for="f-summary">Sapo / tóm tắt * <span class="font-normal text-muted-foreground">(dùng làm mô tả SEO)</span></label>
              <textarea hlmTextarea id="f-summary" name="summary" rows="3" maxlength="1000" data-testid="field-summary" [(ngModel)]="summary"></textarea>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-1.5">
                <label hlmLabel for="f-category">Chuyên mục *</label>
                <select id="f-category" name="category" class="field-select" data-testid="field-category" [(ngModel)]="categoryId">
                  <option value="">— Chọn chuyên mục —</option>
                  @for (c of categories.data()?.items ?? []; track c.id) {
                    <option [value]="c.id.toString()">{{ c.name }} ({{ c.slug }})</option>
                  }
                </select>
              </div>
              <div class="grid gap-1.5">
                <label hlmLabel for="f-slug">Slug URL <span class="font-normal text-muted-foreground">(để trống = tự tạo)</span></label>
                <input hlmInput id="f-slug" name="slug" maxlength="200" data-testid="field-slug" [(ngModel)]="slug" />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-1.5">
                <label hlmLabel for="f-tags">Thẻ <span class="font-normal text-muted-foreground">(cách nhau bởi dấu phẩy)</span></label>
                <input hlmInput id="f-tags" name="tags" data-testid="field-tags" [(ngModel)]="tags" />
              </div>
              <div class="grid gap-1.5">
                <label hlmLabel for="f-cover">Ảnh bìa (URL https)</label>
                <input hlmInput id="f-cover" name="cover" type="url" data-testid="field-cover" [(ngModel)]="cover" />
              </div>
            </div>
            <div class="grid gap-1.5">
              <label hlmLabel for="f-sources">Nguồn tham khảo <span class="font-normal text-muted-foreground">(mỗi dòng một URL)</span></label>
              <textarea hlmTextarea id="f-sources" name="sources" rows="3" class="font-mono text-xs" data-testid="field-sources" [(ngModel)]="sources"></textarea>
            </div>
            <div class="grid gap-1.5">
              <label hlmLabel for="f-body">Nội dung (Markdown) *</label>
              <textarea hlmTextarea id="f-body" name="body" rows="22" class="font-mono text-sm leading-relaxed" data-testid="field-body" [(ngModel)]="body"></textarea>
              <p class="text-xs text-muted-foreground">Hỗ trợ ## tiêu đề, **đậm**, danh sách, [liên kết](https://…), ![ảnh](https://…). HTML thô sẽ bị vô hiệu.</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <button hlmBtn type="submit" [disabled]="busy()" data-testid="save">{{ a ? 'Lưu thay đổi' : 'Tạo bản nháp' }}</button>
              @if (dirty()) { <span class="text-sm text-orange-700" data-testid="unsaved">Có thay đổi chưa lưu</span> }
            </div>
          </form>
        }

        @if (a) {
          <div [class]="editable() ? 'mt-10 border-t border-border pt-6' : ''">
            <h2 class="text-sm font-bold uppercase tracking-wide text-muted-foreground">Xem trước (bản đã lưu)</h2>
            <article class="mt-3" data-testid="preview">
              <h3 class="font-serif text-3xl font-bold leading-tight">{{ a.draft?.title }}</h3>
              <p class="mt-3 font-serif text-lg font-semibold">{{ a.draft?.summary }}</p>
              @if (a.draft?.coverImageUrl) { <img [src]="a.draft?.coverImageUrl" alt="" class="mt-4 max-h-80 w-full rounded-md object-cover" /> }
              <div class="news-prose mt-6" [innerHTML]="a.bodyHtml"></div>
              @if (a.draft?.sourceUrls?.length) {
                <ul class="mt-6 list-disc pl-5 text-sm">
                  @for (url of a.draft?.sourceUrls; track url) { <li><a [href]="url" target="_blank" rel="noopener" class="text-link">{{ url }}</a></li> }
                </ul>
              }
            </article>
          </div>
        }
      </section>

      <!-- ===== Review panel ===== -->
      @if (a) {
        <aside class="grid content-start gap-6" aria-label="Duyệt bài">
          <section class="rounded-xl border border-border bg-card p-4" data-testid="workflow-panel">
            <h2 class="font-semibold">Thao tác</h2>
            @if (a.allowedActions.length) {
              @if (canReview()) {
                <label hlmLabel for="review-note" class="mt-3 block">Ghi chú / góp ý kèm thao tác</label>
                <textarea hlmTextarea id="review-note" rows="3" class="mt-1.5 w-full" data-testid="review-note"
                          placeholder="Bắt buộc khi Yêu cầu sửa (nếu chưa có góp ý mở)" [(ngModel)]="reviewNote"></textarea>
              }
              <div class="mt-3 flex flex-wrap gap-2">
                @for (action of a.allowedActions; track action) {
                  <button hlmBtn type="button" [variant]="actionVariant(action)" [disabled]="busy() || dirty()"
                          [attr.data-testid]="'action-' + actionId[action]" (click)="transition(action)">{{ actionLabel[action] }}</button>
                }
              </div>
              @if (dirty()) { <p class="mt-2 text-xs text-orange-700">Lưu thay đổi trước khi chuyển trạng thái.</p> }
            } @else {
              <p class="mt-2 text-sm text-muted-foreground" data-testid="no-actions">
                @switch (a.status) {
                  @case (inReview) { Đang chờ quản trị viên duyệt. }
                  @default { Không có thao tác nào ở trạng thái này. }
                }
              </p>
            }
          </section>

          <section class="rounded-xl border border-border bg-card p-4" data-testid="comments-panel">
            <h2 class="font-semibold">Góp ý <span class="text-sm font-normal text-muted-foreground">({{ openComments() }} chưa xử lý)</span></h2>
            <ol class="mt-3 grid gap-3">
              @for (c of sortedComments(); track c.id) {
                <li [attr.data-testid]="'comment-' + c.id" [attr.data-open]="!c.resolvedAt"
                    [class]="'rounded-lg border p-3 text-sm ' + (c.resolvedAt ? 'border-border bg-muted/50 text-muted-foreground' : 'border-orange-300 bg-orange-50')">
                  <p class="text-xs"><strong>{{ c.author }}</strong> · bản {{ c.revision }} · {{ c.createdAt | vnTime }}</p>
                  @if (c.quote) { <blockquote class="mt-1 border-l-2 border-orange-400 pl-2 italic">“{{ c.quote }}”</blockquote> }
                  <p class="mt-1 whitespace-pre-line text-foreground" data-testid="comment-body">{{ c.body }}</p>
                  @if (c.resolvedAt) {
                    <p class="mt-2 text-xs">✓ Đã xử lý bởi {{ c.resolvedBy }}{{ c.resolutionNote ? ': ' + c.resolutionNote : '' }}</p>
                  } @else {
                    <div class="mt-2 flex gap-2">
                      <input hlmInput class="h-8 text-xs" placeholder="Đã sửa gì? (tùy chọn)" [attr.aria-label]="'Ghi chú xử lý góp ý ' + c.id"
                             [attr.data-testid]="'resolve-note-' + c.id" #note />
                      <button hlmBtn size="sm" variant="outline" type="button" [disabled]="busy()"
                              [attr.data-testid]="'resolve-' + c.id" (click)="resolve(c.id, note.value)">Đã xử lý</button>
                    </div>
                  }
                </li>
              } @empty {
                <li class="text-sm text-muted-foreground">Chưa có góp ý.</li>
              }
            </ol>
            <form class="mt-4 grid gap-2" (ngSubmit)="addComment()" data-testid="comment-form">
              <label hlmLabel for="c-quote">Đoạn trích (tùy chọn)</label>
              <input hlmInput id="c-quote" name="quote" data-testid="comment-quote" [(ngModel)]="commentQuote" />
              <label hlmLabel for="c-body">Góp ý mới</label>
              <textarea hlmTextarea id="c-body" name="comment" rows="3" data-testid="comment-input" [(ngModel)]="commentBody"></textarea>
              <button hlmBtn variant="secondary" size="sm" type="submit" [disabled]="busy() || !commentBody.trim()" data-testid="comment-submit">Gửi góp ý</button>
            </form>
          </section>

          <section class="rounded-xl border border-border bg-card p-4" data-testid="revisions-panel">
            <h2 class="font-semibold">Lịch sử phiên bản</h2>
            <ul class="mt-2 grid gap-1 text-sm">
              @for (r of a.revisions; track r.revision) {
                <li class="flex items-center justify-between gap-2">
                  <span>Bản {{ r.revision }} · {{ r.editedBy }} · {{ r.createdAt | vnTime }}</span>
                  <button type="button" class="cursor-pointer text-link hover:underline" [attr.data-testid]="'view-revision-' + r.revision"
                          (click)="showRevision(r.revision)">Xem</button>
                </li>
              }
            </ul>
            @if (revision(); as r) {
              <div class="mt-3 rounded-md border border-border bg-muted/50 p-3" data-testid="revision-view">
                <div class="flex items-center justify-between text-xs font-semibold">
                  <span>Bản {{ r.revision }}: {{ r.title }}</span>
                  <button type="button" class="cursor-pointer text-muted-foreground hover:text-foreground" (click)="revision.set(undefined)">Đóng</button>
                </div>
                <pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{{ r.summary }}

{{ r.bodyMarkdown }}</pre>
              </div>
            }
          </section>
        </aside>
      }
    </div>
  `,
})
export class ArticleEditorPage {
  readonly id = input<string>();

  private readonly api = inject(ProtoApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusClass = STATUS_CLASS;
  protected readonly actionLabel = ACTION_LABEL;
  protected readonly actionId = ACTION_ID;
  protected readonly published = ArticleStatus.PUBLISHED;
  protected readonly inReview = ArticleStatus.IN_REVIEW;

  protected readonly article = protoResource(AdminArticleSchema, () => (this.id() ? `/api/v1/admin/articles/${this.id()}` : undefined));
  protected readonly categories = protoResource(CategoryListSchema, () => '/api/v1/public/categories');

  /** Changes only when saved content changes (id/version): adding or resolving a comment keeps unsaved edits. */
  private readonly draftKey = computed(() => {
    const a = this.article.data();
    return a ? `${a.id}:${a.draft?.version}` : '';
  });
  private readonly draft = computed(() => {
    this.draftKey();
    return untracked(() => this.article.data()?.draft);
  });
  protected readonly title = linkedSignal(() => this.draft()?.title ?? '');
  protected readonly slug = linkedSignal(() => this.draft()?.slug ?? '');
  protected readonly summary = linkedSignal(() => this.draft()?.summary ?? '');
  protected readonly body = linkedSignal(() => this.draft()?.bodyMarkdown ?? '');
  protected readonly categoryId = linkedSignal(() => (this.draft()?.categoryId ? this.draft()!.categoryId.toString() : ''));
  protected readonly tags = linkedSignal(() => this.draft()?.tags.join(', ') ?? '');
  protected readonly cover = linkedSignal(() => this.draft()?.coverImageUrl ?? '');
  protected readonly sources = linkedSignal(() => this.draft()?.sourceUrls.join('\n') ?? '');

  protected quickPaste = '';
  protected reviewNote = '';
  protected commentBody = '';
  protected commentQuote = '';
  protected readonly busy = signal(false);
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected readonly revision = signal<Revision | undefined>(undefined);

  protected readonly editable = computed(() => !this.id() || (this.article.data()?.editable ?? false));
  protected readonly canReview = computed(() => this.auth.me()?.role === Role.ADMIN);
  protected readonly dirty = computed(() => {
    const d = this.draft();
    if (!d) {
      return false;
    }
    return (
      this.title() !== d.title ||
      this.slug() !== d.slug ||
      this.summary() !== d.summary ||
      this.body() !== d.bodyMarkdown ||
      this.categoryId() !== d.categoryId.toString() ||
      this.tags() !== d.tags.join(', ') ||
      this.cover() !== d.coverImageUrl ||
      this.sources() !== d.sourceUrls.join('\n')
    );
  });
  protected readonly sortedComments = computed(() =>
    [...(this.article.data()?.comments ?? [])].sort((x, y) => Number(!!x.resolvedAt) - Number(!!y.resolvedAt)),
  );
  protected readonly openComments = computed(() => this.article.data()?.comments.filter((c) => !c.resolvedAt).length ?? 0);

  constructor() {
    effect(() => {
      if (this.article.error()) {
        this.error.set(errorMessage(this.article.error()));
      }
    });
  }

  protected statusName(status: ArticleStatus): string {
    return ArticleStatus[status];
  }

  protected actionVariant(action: WorkflowAction): 'default' | 'outline' | 'destructive' {
    return action === WorkflowAction.PUBLISH || action === WorkflowAction.SUBMIT
      ? 'default'
      : action === WorkflowAction.REJECT || action === WorkflowAction.UNPUBLISH
        ? 'destructive'
        : 'outline';
  }

  protected applyQuickPaste(): void {
    const parsed = parseQuickPaste(this.quickPaste);
    if (parsed.title !== undefined) this.title.set(parsed.title);
    if (parsed.slug !== undefined) this.slug.set(parsed.slug);
    if (parsed.summary !== undefined) this.summary.set(parsed.summary);
    if (parsed.tags) this.tags.set(parsed.tags.join(', '));
    if (parsed.cover !== undefined) this.cover.set(parsed.cover);
    if (parsed.sources) this.sources.set(parsed.sources.join('\n'));
    if (parsed.body) this.body.set(parsed.body);
    if (parsed.category) {
      const wanted = parsed.category.toLowerCase();
      const match = this.categories.data()?.items.find((c) => c.slug === wanted || c.name.toLowerCase() === wanted);
      if (match) {
        this.categoryId.set(match.id.toString());
      } else {
        this.error.set(`Không tìm thấy chuyên mục “${parsed.category}”. Hãy chọn trong danh sách.`);
        return;
      }
    }
    this.error.set('');
    this.notice.set('Đã điền form từ khối dán nhanh. Kiểm tra lại rồi bấm Lưu.');
  }

  protected save(): Promise<void> {
    const body = {
      title: this.title(),
      slug: this.slug(),
      summary: this.summary(),
      bodyMarkdown: this.body(),
      categoryId: BigInt(this.categoryId() || '0'),
      tags: this.tags().split(',').map((t) => t.trim()).filter(Boolean),
      coverImageUrl: this.cover(),
      sourceUrls: this.sources().split('\n').map((s) => s.trim()).filter(Boolean),
      version: this.draft()?.version ?? 0n,
    };
    const id = this.id();
    return this.run('Đã lưu.', async () => {
      const saved = await firstValueFrom(
        id
          ? this.api.send('PUT', `/api/v1/admin/articles/${id}`, ArticleDraftSchema, body, AdminArticleSchema)
          : this.api.send('POST', '/api/v1/admin/articles', ArticleDraftSchema, body, AdminArticleSchema),
      );
      if (!id) {
        await this.router.navigate(['/admin/bai-viet', saved.id.toString()], { replaceUrl: true });
      }
      return saved;
    });
  }

  protected transition(action: WorkflowAction): Promise<void> {
    const a = this.article.data()!;
    return this.run(`Đã ${ACTION_LABEL[action].toLowerCase()}.`, async () => {
      const updated = await firstValueFrom(
        this.api.send(
          'POST',
          `/api/v1/admin/articles/${a.id}/transitions`,
          TransitionRequestSchema,
          { action, version: a.draft?.version ?? 0n, note: this.reviewNote },
          AdminArticleSchema,
        ),
      );
      this.reviewNote = '';
      return updated;
    });
  }

  protected addComment(): Promise<void> {
    const a = this.article.data()!;
    return this.run('Đã gửi góp ý.', async () => {
      const updated = await firstValueFrom(
        this.api.send('POST', `/api/v1/admin/articles/${a.id}/comments`, CommentRequestSchema,
          { body: this.commentBody, quote: this.commentQuote }, AdminArticleSchema),
      );
      this.commentBody = '';
      this.commentQuote = '';
      return updated;
    });
  }

  protected resolve(commentId: bigint, note: string): Promise<void> {
    const a = this.article.data()!;
    return this.run('Đã đánh dấu xử lý góp ý.', () =>
      firstValueFrom(
        this.api.send('POST', `/api/v1/admin/articles/${a.id}/comments/${commentId}/resolve`, ResolveCommentRequestSchema,
          { note }, AdminArticleSchema),
      ),
    );
  }

  protected async showRevision(revision: number): Promise<void> {
    const a = this.article.data()!;
    try {
      this.revision.set(await firstValueFrom(this.api.get(`/api/v1/admin/articles/${a.id}/revisions/${revision}`, RevisionSchema)));
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  /** Runs a mutation, then shows the article the server returned (new version, comments, allowed actions). */
  private async run(success: string, mutation: () => Promise<AdminArticle>): Promise<void> {
    this.busy.set(true);
    this.notice.set('');
    this.error.set('');
    try {
      const updated = await mutation();
      this.article.set(updated);
      this.notice.set(success);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}

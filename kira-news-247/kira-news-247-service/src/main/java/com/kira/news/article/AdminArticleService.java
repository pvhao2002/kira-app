package com.kira.news.article;

import com.kira.news.article.ArticleWorkflow.Allowed;
import com.kira.news.article.ArticleWorkflow.Denied;
import com.kira.news.category.CategoryRepository;
import com.kira.news.identity.CurrentUser;
import com.kira.news.proto.v1.*;
import com.kira.news.shared.ApiException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

import static com.kira.news.shared.ApiException.require;
import static com.kira.news.shared.Protobuf.millis;
import static com.kira.news.shared.Protobuf.text;

@Service
@Transactional
public class AdminArticleService {
    private final ArticleRepository articles;
    private final ArticleRevisionRepository revisions;
    private final ReviewCommentRepository comments;
    private final CategoryRepository categories;

    public AdminArticleService(ArticleRepository articles, ArticleRevisionRepository revisions,
                               ReviewCommentRepository comments, CategoryRepository categories) {
        this.articles = articles;
        this.revisions = revisions;
        this.comments = comments;
        this.categories = categories;
    }

    @Transactional(readOnly = true)
    public AdminArticlePage list(com.kira.news.proto.v1.ArticleStatus status, String query, int page, int size) {
        var domainStatus = status == com.kira.news.proto.v1.ArticleStatus.ARTICLE_STATUS_UNSPECIFIED
                || status == com.kira.news.proto.v1.ArticleStatus.UNRECOGNIZED ? null : ArticleStatus.valueOf(status.name());
        var pattern = query.isBlank() ? null : "%" + query.strip().toLowerCase(Locale.ROOT) + "%";
        var result = articles.findAdminRows(domainStatus, pattern, PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100)));
        return AdminArticlePage.newBuilder()
                .addAllItems(result.getContent().stream().map(ArticleRows.AdminRow::toProto).toList())
                .setTotal(result.getTotalElements())
                .setPage(result.getNumber())
                .setSize(result.getSize())
                .addAllCounts(articles.countByStatus().stream().map(ArticleRows.StatusTotal::toProto).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public AdminArticle get(long id, CurrentUser user) {
        return view(load(id), user);
    }

    public AdminArticle create(ArticleDraft draft, CurrentUser user) {
        var content = ArticleDrafts.validate(draft);
        var article = new Article(user.username());
        article.edit(withUniqueSlug(content, 0), category(content.categoryId()));
        articles.save(article);
        revisions.save(new ArticleRevision(article, user.username()));
        return view(article, user);
    }

    public AdminArticle update(long id, ArticleDraft draft, CurrentUser user) {
        var article = load(id);
        checkVersion(article, draft.getVersion());
        if (!ArticleWorkflow.canEdit(article.getStatus(), user.role())) {
            throw ApiException.conflict("NOT_EDITABLE", "Không thể sửa bài ở trạng thái " + article.getStatus() + ".");
        }
        var content = ArticleDrafts.validate(draft);
        if (article.getPublishedAt() != null) {
            // the URL is public (search engines, shares): never change it after first publication
            content = new ArticleContent(article.getSlug(), content.title(), content.summary(), content.bodyMarkdown(),
                    content.categoryId(), content.tags(), content.coverImageUrl(), content.sourceUrls());
        } else {
            content = withUniqueSlug(content, id);
        }
        article.edit(content, category(content.categoryId()));
        articles.flush();
        revisions.save(new ArticleRevision(article, user.username()));
        return view(article, user);
    }

    public AdminArticle transition(long id, TransitionRequest request, CurrentUser user) {
        var article = load(id);
        checkVersion(article, request.getVersion());
        require(request.getAction() != com.kira.news.proto.v1.WorkflowAction.WORKFLOW_ACTION_UNSPECIFIED
                && request.getAction() != com.kira.news.proto.v1.WorkflowAction.UNRECOGNIZED, "INVALID_ACTION", "Thiếu thao tác.");
        var action = WorkflowAction.valueOf(request.getAction().name());
        var note = request.getNote().strip();
        require(note.length() <= 4000, "INVALID_NOTE", "Ghi chú tối đa 4000 ký tự.");

        var next = switch (ArticleWorkflow.decide(article.getStatus(), action, user.role())) {
            case Allowed(var status) -> status;
            case Denied(var reason) -> throw ApiException.conflict("INVALID_TRANSITION", reason);
        };
        if (!note.isEmpty() && (action == WorkflowAction.REQUEST_CHANGES || action == WorkflowAction.REJECT)) {
            comments.save(new ReviewComment(id, article.getRevision(), user.username(), user.role(), note, null));
        }
        var open = comments.countByArticleIdAndResolvedAtIsNull(id);
        switch (action) {
            case REQUEST_CHANGES -> require(open > 0, "COMMENT_REQUIRED", "Hãy ghi góp ý trước khi yêu cầu sửa.");
            case SUBMIT -> require(open == 0, "OPEN_COMMENTS",
                    "Còn " + open + " góp ý chưa xử lý. Sửa bài rồi bấm \"Đã xử lý\" cho từng góp ý trước khi gửi duyệt.");
            default -> {
            }
        }
        article.moveTo(next);
        articles.flush();
        return view(article, user);
    }

    public AdminArticle comment(long id, CommentRequest request, CurrentUser user) {
        var article = load(id);
        var body = request.getBody().strip();
        require(!body.isEmpty() && body.length() <= 4000, "INVALID_COMMENT", "Góp ý 1-4000 ký tự.");
        var quote = request.getQuote().strip();
        require(quote.length() <= 1000, "INVALID_QUOTE", "Trích dẫn tối đa 1000 ký tự.");
        comments.save(new ReviewComment(id, article.getRevision(), user.username(), user.role(), body,
                quote.isEmpty() ? null : quote));
        return view(article, user);
    }

    public AdminArticle resolveComment(long id, long commentId, ResolveCommentRequest request, CurrentUser user) {
        var article = load(id);
        var comment = comments.findByIdAndArticleId(commentId, id)
                .orElseThrow(() -> ApiException.notFound("COMMENT_NOT_FOUND", "Không tìm thấy góp ý."));
        require(comment.isOpen(), "ALREADY_RESOLVED", "Góp ý này đã được xử lý.");
        var note = request.getNote().strip();
        require(note.length() <= 1000, "INVALID_NOTE", "Ghi chú tối đa 1000 ký tự.");
        comment.resolve(user.username(), note.isEmpty() ? null : note);
        return view(article, user);
    }

    @Transactional(readOnly = true)
    public Revision revision(long id, int revision) {
        var snapshot = revisions.findByArticleIdAndRevision(id, revision)
                .orElseThrow(() -> ApiException.notFound("REVISION_NOT_FOUND", "Không tìm thấy phiên bản."));
        return Revision.newBuilder()
                .setRevision(snapshot.getRevision())
                .setEditedBy(snapshot.getEditedBy())
                .setCreatedAt(millis(snapshot.getCreatedAt()))
                .setTitle(snapshot.getTitle())
                .setSummary(text(snapshot.getSummary()))
                .setBodyMarkdown(snapshot.getBodyMarkdown())
                .build();
    }

    private Article load(long id) {
        return articles.findWithCategoryById(id)
                .orElseThrow(() -> ApiException.notFound("ARTICLE_NOT_FOUND", "Không tìm thấy bài viết."));
    }

    private com.kira.news.category.Category category(long id) {
        return categories.findById(id)
                .orElseThrow(() -> ApiException.badRequest("INVALID_CATEGORY", "Chuyên mục không tồn tại."));
    }

    private static void checkVersion(Article article, long version) {
        if (article.getVersion() != version) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION",
                    "Bài viết đã thay đổi kể từ lúc bạn mở. Hãy tải lại trang rồi thao tác lại.");
        }
    }

    /** Appends -2, -3 … when the slug is taken by another article. */
    private ArticleContent withUniqueSlug(ArticleContent content, long selfId) {
        var slug = content.slug();
        for (var n = 2; articles.existsBySlugAndIdNot(slug, selfId); n++) {
            slug = content.slug() + "-" + n;
        }
        return slug.equals(content.slug()) ? content : new ArticleContent(slug, content.title(), content.summary(),
                content.bodyMarkdown(), content.categoryId(), content.tags(), content.coverImageUrl(), content.sourceUrls());
    }

    private AdminArticle view(Article article, CurrentUser user) {
        var draft = ArticleDraft.newBuilder()
                .setTitle(article.getTitle())
                .setSlug(article.getSlug())
                .setSummary(text(article.getSummary()))
                .setBodyMarkdown(article.getBodyMarkdown())
                .setCategoryId(article.getCategory().getId())
                .addAllTags(article.getTags())
                .setCoverImageUrl(text(article.getCoverImageUrl()))
                .addAllSourceUrls(article.getSourceUrls())
                .setVersion(article.getVersion());
        return AdminArticle.newBuilder()
                .setId(article.getId())
                .setStatus(article.getStatus().toProto())
                .setDraft(draft)
                .setBodyHtml(article.getBodyHtml())
                .setRevision(article.getRevision())
                .setCreatedBy(article.getCreatedBy())
                .setCreatedAt(millis(article.getCreatedAt()))
                .setUpdatedAt(millis(article.getUpdatedAt()))
                .setPublishedAt(millis(article.getPublishedAt()))
                .setViewCount(article.getViewCount())
                .addAllComments(comments.findByArticleIdOrderByCreatedAtAsc(article.getId()).stream()
                        .map(ReviewComment::toProto).toList())
                .addAllRevisions(revisions.findSummaries(article.getId()).stream()
                        .map(row -> RevisionSummary.newBuilder()
                                .setRevision(row.revision())
                                .setEditedBy(row.editedBy())
                                .setCreatedAt(millis(row.createdAt()))
                                .build())
                        .toList())
                .addAllAllowedActions(ArticleWorkflow.allowedActions(article.getStatus(), user.role()).stream()
                        .map(WorkflowAction::toProto).toList())
                .setEditable(ArticleWorkflow.canEdit(article.getStatus(), user.role()))
                .build();
    }
}

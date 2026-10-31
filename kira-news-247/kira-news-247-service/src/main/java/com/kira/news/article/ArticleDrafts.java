package com.kira.news.article;

import com.kira.news.proto.v1.ArticleDraft;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;

import static com.kira.news.shared.ApiException.require;

/** Trust-boundary validation of drafts written by the AI agent or the admin. */
public final class ArticleDrafts {
    private ArticleDrafts() {
    }

    public static ArticleContent validate(ArticleDraft draft) {
        var title = draft.getTitle().strip();
        require(title.length() >= 5 && title.length() <= 300, "INVALID_TITLE", "Tiêu đề phải từ 5 đến 300 ký tự.");
        var summary = draft.getSummary().strip();
        require(!summary.isEmpty() && summary.length() <= 1000, "INVALID_SUMMARY", "Sapo (tóm tắt) bắt buộc, tối đa 1000 ký tự.");
        var body = draft.getBodyMarkdown().strip();
        require(body.length() >= 50 && body.length() <= 200_000, "INVALID_BODY", "Nội dung phải từ 50 đến 200.000 ký tự.");
        require(draft.getCategoryId() > 0, "INVALID_CATEGORY", "Chưa chọn chuyên mục.");

        var slug = Slugs.of(draft.getSlug().isBlank() ? title : draft.getSlug());
        require(!slug.isEmpty(), "INVALID_SLUG", "Slug không hợp lệ.");

        var tags = List.copyOf(new LinkedHashSet<>(draft.getTagsList().stream()
                .map(tag -> tag.replaceAll("\\s+", " ").strip())
                .filter(tag -> !tag.isEmpty())
                .toList()));
        require(tags.size() <= 10 && tags.stream().allMatch(tag -> tag.length() <= 50), "INVALID_TAGS",
                "Tối đa 10 thẻ, mỗi thẻ tối đa 50 ký tự.");

        var cover = draft.getCoverImageUrl().strip();
        require(cover.isEmpty() || isHttpUrl(cover, 1000), "INVALID_COVER", "Ảnh bìa phải là URL http(s).");

        var sources = draft.getSourceUrlsList().stream().map(String::strip).filter(url -> !url.isEmpty()).distinct().toList();
        require(sources.size() <= 10 && sources.stream().allMatch(url -> isHttpUrl(url, 380)), "INVALID_SOURCES",
                "Nguồn tham khảo: tối đa 10 URL http(s), mỗi URL tối đa 380 ký tự.");

        return new ArticleContent(slug, title, summary, body, draft.getCategoryId(), tags,
                cover.isEmpty() ? null : cover, sources);
    }

    static boolean isHttpUrl(String value, int maxLength) {
        if (value.length() > maxLength) {
            return false;
        }
        try {
            var uri = URI.create(value);
            return ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) && uri.getHost() != null;
        } catch (IllegalArgumentException _) {
            return false;
        }
    }
}

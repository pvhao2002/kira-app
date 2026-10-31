package com.kira.news.article;

import java.util.List;

/** Validated editable content of an article. */
public record ArticleContent(String slug, String title, String summary, String bodyMarkdown, long categoryId,
                             List<String> tags, String coverImageUrl, List<String> sourceUrls) {
}

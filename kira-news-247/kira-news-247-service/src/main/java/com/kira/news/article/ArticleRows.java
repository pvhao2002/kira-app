package com.kira.news.article;

import com.kira.news.proto.v1.AdminArticleRow;
import com.kira.news.proto.v1.ArticleCard;
import com.kira.news.proto.v1.Category;
import com.kira.news.proto.v1.StatusCount;

import java.time.Instant;

import static com.kira.news.shared.Protobuf.millis;
import static com.kira.news.shared.Protobuf.text;

/** JPQL projections, so list pages never load CLOB bodies. */
public final class ArticleRows {
    private ArticleRows() {
    }

    public record CardRow(Long id, String slug, String title, String summary, String coverImageUrl, Instant publishedAt,
                          int readingMinutes, Long categoryId, String categorySlug, String categoryName) {
        public ArticleCard toProto() {
            return ArticleCard.newBuilder()
                    .setId(id)
                    .setSlug(slug)
                    .setTitle(title)
                    .setSummary(text(summary))
                    .setCoverImageUrl(text(coverImageUrl))
                    .setCategory(Category.newBuilder().setId(categoryId).setSlug(categorySlug).setName(categoryName))
                    .setPublishedAt(millis(publishedAt))
                    .setReadingMinutes(readingMinutes)
                    .build();
        }
    }

    public record AdminRow(Long id, String slug, String title, ArticleStatus status, String categoryName, String createdBy,
                           int revision, Instant updatedAt, Instant publishedAt, long viewCount, long openComments) {
        public AdminArticleRow toProto() {
            return AdminArticleRow.newBuilder()
                    .setId(id)
                    .setSlug(slug)
                    .setTitle(title)
                    .setStatus(status.toProto())
                    .setCategoryName(categoryName)
                    .setCreatedBy(createdBy)
                    .setRevision(revision)
                    .setOpenComments((int) openComments)
                    .setUpdatedAt(millis(updatedAt))
                    .setPublishedAt(millis(publishedAt))
                    .setViewCount(viewCount)
                    .build();
        }
    }

    public record StatusTotal(ArticleStatus status, long count) {
        public StatusCount toProto() {
            return StatusCount.newBuilder().setStatus(status.toProto()).setCount(count).build();
        }
    }

    public record RevisionRow(int revision, String editedBy, Instant createdAt) {
    }

    public record FeedRow(String slug, String title, String summary, Instant publishedAt, Instant updatedAt,
                          String categoryName) {
    }
}

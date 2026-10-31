package com.kira.news.article;

import com.kira.news.category.Category;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "article")
public class Article {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String slug;
    private String title;
    private String summary;
    @Lob
    private String bodyMarkdown;
    @Lob
    private String bodyHtml;
    private int readingMinutes;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Category category;
    @Convert(converter = StringListConverter.class)
    private List<String> tags;
    private String coverImageUrl;
    @Convert(converter = StringListConverter.class)
    private List<String> sourceUrls;
    @Enumerated(EnumType.STRING)
    private ArticleStatus status;
    private int revision;
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant publishedAt;
    @Column(updatable = false) // only changed by the bulk incrementViews update
    private long viewCount;
    @Version
    private long version;

    protected Article() {
    }

    public Article(String createdBy) {
        this.createdBy = createdBy;
        this.status = ArticleStatus.DRAFT;
        this.revision = 0;
        this.createdAt = Instant.now();
    }

    /** Replaces the editable content and bumps the revision number. */
    public void edit(ArticleContent content, Category category) {
        this.slug = content.slug();
        this.title = content.title();
        this.summary = content.summary();
        this.bodyMarkdown = content.bodyMarkdown();
        this.bodyHtml = Markdown.toHtml(content.bodyMarkdown());
        this.readingMinutes = Markdown.readingMinutes(content.bodyMarkdown());
        this.category = category;
        this.tags = content.tags();
        this.coverImageUrl = content.coverImageUrl();
        this.sourceUrls = content.sourceUrls();
        this.revision++;
        this.updatedAt = Instant.now();
    }

    public void moveTo(ArticleStatus next) {
        if (next == ArticleStatus.PUBLISHED && publishedAt == null) {
            publishedAt = Instant.now();
        }
        this.status = next;
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getTitle() {
        return title;
    }

    public String getSummary() {
        return summary;
    }

    public String getBodyMarkdown() {
        return bodyMarkdown;
    }

    public String getBodyHtml() {
        return bodyHtml;
    }

    public int getReadingMinutes() {
        return readingMinutes;
    }

    public Category getCategory() {
        return category;
    }

    public List<String> getTags() {
        return tags;
    }

    public String getCoverImageUrl() {
        return coverImageUrl;
    }

    public List<String> getSourceUrls() {
        return sourceUrls;
    }

    public ArticleStatus getStatus() {
        return status;
    }

    public int getRevision() {
        return revision;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public long getViewCount() {
        return viewCount;
    }

    public long getVersion() {
        return version;
    }
}

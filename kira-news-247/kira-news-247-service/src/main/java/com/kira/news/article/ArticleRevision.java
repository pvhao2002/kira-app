package com.kira.news.article;

import jakarta.persistence.*;

import java.time.Instant;

/** Snapshot written on every content save so the reviewer can see what the AI changed. */
@Entity
@Table(name = "article_revision")
public class ArticleRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long articleId;
    private int revision;
    private String title;
    private String summary;
    @Lob
    private String bodyMarkdown;
    private String editedBy;
    private Instant createdAt;

    protected ArticleRevision() {
    }

    public ArticleRevision(Article article, String editedBy) {
        this.articleId = article.getId();
        this.revision = article.getRevision();
        this.title = article.getTitle();
        this.summary = article.getSummary();
        this.bodyMarkdown = article.getBodyMarkdown();
        this.editedBy = editedBy;
        this.createdAt = Instant.now();
    }

    public int getRevision() {
        return revision;
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

    public String getEditedBy() {
        return editedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

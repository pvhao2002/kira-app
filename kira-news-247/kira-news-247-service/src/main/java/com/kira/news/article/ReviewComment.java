package com.kira.news.article;

import com.kira.news.identity.Role;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "review_comment")
public class ReviewComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long articleId;
    private String author;
    @Enumerated(EnumType.STRING)
    private Role authorRole;
    @Lob
    private String body;
    private String quote;
    private int revision;
    private Instant createdAt;
    private Instant resolvedAt;
    private String resolvedBy;
    private String resolutionNote;

    protected ReviewComment() {
    }

    public ReviewComment(long articleId, int revision, String author, Role authorRole, String body, String quote) {
        this.articleId = articleId;
        this.revision = revision;
        this.author = author;
        this.authorRole = authorRole;
        this.body = body;
        this.quote = quote;
        this.createdAt = Instant.now();
    }

    public void resolve(String by, String note) {
        this.resolvedAt = Instant.now();
        this.resolvedBy = by;
        this.resolutionNote = note;
    }

    public boolean isOpen() {
        return resolvedAt == null;
    }

    public com.kira.news.proto.v1.ReviewComment toProto() {
        return com.kira.news.proto.v1.ReviewComment.newBuilder()
                .setId(id)
                .setAuthor(author)
                .setAuthorRole(authorRole.toProto())
                .setBody(body)
                .setQuote(quote == null ? "" : quote)
                .setRevision(revision)
                .setCreatedAt(createdAt.toEpochMilli())
                .setResolvedAt(resolvedAt == null ? 0 : resolvedAt.toEpochMilli())
                .setResolvedBy(resolvedBy == null ? "" : resolvedBy)
                .setResolutionNote(resolutionNote == null ? "" : resolutionNote)
                .build();
    }
}

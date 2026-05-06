package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import kira.schema.entity.enums.BlogStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "blogs",
        indexes = {
                @Index(name = "uk_blogs_slug", columnList = "slug", unique = true),
                @Index(name = "idx_blogs_status", columnList = "status"),
                @Index(name = "idx_blogs_created_at", columnList = "created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class Blog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "blog_id")
    private Long blogId;

    @Column(name = "topic", nullable = false, length = 255)
    private String topic;

    @Column(name = "slug", nullable = false, length = 255)
    private String slug;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Lob
    @Column(name = "excerpt", columnDefinition = "TEXT")
    private String excerpt;

    @Lob
    @Column(name = "tags", columnDefinition = "LONGTEXT")
    private String tags;

    @Lob
    @Column(name = "html_content", nullable = false, columnDefinition = "LONGTEXT")
    private String htmlContent;

    @Column(name = "layout_variant", nullable = false, length = 32)
    private String layoutVariant;

    @Column(name = "model", nullable = false, length = 100)
    private String model;

    @Lob
    @Column(name = "prompt", nullable = false, columnDefinition = "LONGTEXT")
    private String prompt;

    @Column(name = "source_prompt_hash", nullable = false, length = 64)
    private String sourcePromptHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('draft','published') not null default 'draft'")
    private BlogStatus status = BlogStatus.draft;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "regenerate_count", nullable = false, columnDefinition = "int not null default 0")
    private Integer regenerateCount = 0;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}

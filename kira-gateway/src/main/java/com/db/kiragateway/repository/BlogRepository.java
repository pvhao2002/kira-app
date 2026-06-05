package com.db.kiragateway.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class BlogRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public long insert(BlogInsertCommand command) {
        var sql = """
                insert into blogs (
                    topic, slug, title, excerpt, tags, html_content, layout_variant,
                    model, prompt, source_prompt_hash, status, published_at, created_by,
                    regenerate_count, created_at, updated_at
                ) values (
                    :topic, :slug, :title, :excerpt, :tags, :html_content, :layout_variant,
                    :model, :prompt, :source_prompt_hash, :status, :published_at, :created_by,
                    :regenerate_count, :created_at, :updated_at
                )
                """;
        var now = LocalDateTime.now();
        var params = new MapSqlParameterSource()
                .addValue("topic", command.topic())
                .addValue("slug", command.slug())
                .addValue("title", command.title())
                .addValue("excerpt", command.excerpt())
                .addValue("tags", command.tagsJson())
                .addValue("html_content", command.htmlContent())
                .addValue("layout_variant", command.layoutVariant())
                .addValue("model", command.model())
                .addValue("prompt", command.prompt())
                .addValue("source_prompt_hash", command.sourcePromptHash())
                .addValue("status", command.status())
                .addValue("published_at", command.publishedAt())
                .addValue("created_by", command.createdBy())
                .addValue("regenerate_count", command.regenerateCount())
                .addValue("created_at", now)
                .addValue("updated_at", now);
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update(sql, params, keyHolder, new String[]{"blog_id"});
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("insert blogs returned no key");
        }
        return key.longValue();
    }

    public Optional<BlogRow> findById(long blogId) {
        var sql = """
                select blog_id, topic, slug, title, excerpt, tags, html_content, layout_variant,
                       model, prompt, source_prompt_hash, status, published_at, created_by,
                       regenerate_count, created_at, updated_at
                from blogs
                where blog_id = :blog_id
                limit 1
                """;
        List<BlogRow> rows = jdbc.query(
                sql,
                new MapSqlParameterSource("blog_id", blogId),
                (rs, rowNum) -> new BlogRow(
                        rs.getLong("blog_id"),
                        rs.getString("topic"),
                        rs.getString("slug"),
                        rs.getString("title"),
                        rs.getString("excerpt"),
                        rs.getString("tags"),
                        rs.getString("html_content"),
                        rs.getString("layout_variant"),
                        rs.getString("model"),
                        rs.getString("prompt"),
                        rs.getString("source_prompt_hash"),
                        rs.getString("status"),
                        toLocalDateTime(rs.getTimestamp("published_at")),
                        rs.getString("created_by"),
                        rs.getInt("regenerate_count"),
                        toLocalDateTime(rs.getTimestamp("created_at")),
                        toLocalDateTime(rs.getTimestamp("updated_at"))
                )
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    private static LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    public record BlogInsertCommand(
            String topic,
            String slug,
            String title,
            String excerpt,
            String tagsJson,
            String htmlContent,
            String layoutVariant,
            String model,
            String prompt,
            String sourcePromptHash,
            String status,
            LocalDateTime publishedAt,
            String createdBy,
            int regenerateCount
    ) {
    }

    public record BlogRow(
            long blogId,
            String topic,
            String slug,
            String title,
            String excerpt,
            String tagsJson,
            String htmlContent,
            String layoutVariant,
            String model,
            String prompt,
            String sourcePromptHash,
            String status,
            LocalDateTime publishedAt,
            String createdBy,
            int regenerateCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }
}

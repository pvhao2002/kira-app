package com.matchmind.prompt;

import com.matchmind.shared.ApiException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PromptService {
    private final PromptTemplateRepository prompts;
    private final NamedParameterJdbcTemplate jdbc;

    public record PromptView(UUID id, String name, String templateType, String content, String description, int version,
                             boolean active, UUID updatedBy, Instant createdAt, Instant updatedAt) {
        static PromptView of(PromptTemplate t) {
            return new PromptView(t.getId(), t.getName(), t.getTemplateType(), t.getContent(), t.getDescription(),
                t.getVersion(), t.isActive(), t.getUpdatedBy(), t.getCreatedAt(), t.getUpdatedAt());
        }
    }

    public record CreatePrompt(@NotBlank @Size(max = 128) String name,
                               @NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,63}$") String templateType,
                               @NotBlank @Size(max = 200_000) String content, @Size(max = 2000) String description) {
    }

    /** {@code expectedVersion} is the version the editor loaded; a mismatch means someone else saved first. */
    public record UpdatePrompt(@NotBlank @Size(max = 200_000) String content, @Size(max = 2000) String description,
                               @NotNull Boolean active, @NotNull Integer expectedVersion) {
    }

    @Transactional(readOnly = true)
    public List<PromptView> list() {
        return prompts.findAllByOrderByTemplateTypeAscNameAsc().stream().map(PromptView::of).toList();
    }

    @Transactional(readOnly = true)
    public PromptView get(UUID id) {
        return PromptView.of(prompts.findById(id).orElseThrow(PromptService::notFound));
    }

    @Transactional
    public PromptView create(CreatePrompt r, UUID actor) {
        if (prompts.existsByName(r.name().trim())) throw ApiException.conflict("PROMPT_NAME_EXISTS", "A template with this name already exists");
        PromptTemplate t = new PromptTemplate();
        t.setName(r.name().trim());
        t.setTemplateType(r.templateType());
        t.setContent(r.content());
        t.setDescription(r.description());
        t.setUpdatedBy(actor);
        return PromptView.of(prompts.saveAndFlush(t));
    }

    @Transactional
    public PromptView update(UUID id, UpdatePrompt r, UUID actor) {
        PromptTemplate t = prompts.lockById(id).orElseThrow(PromptService::notFound);
        if (t.getVersion() != r.expectedVersion()) {
            throw ApiException.conflict("PROMPT_VERSION_CONFLICT",
                "This template was saved by someone else (now version " + t.getVersion() + "). Reload before saving.");
        }
        boolean changed = !t.getContent().equals(r.content()) || !Objects.equals(t.getDescription(), r.description())
            || t.isActive() != r.active();
        if (!changed) return PromptView.of(t);
        t.setContent(r.content());
        t.setDescription(r.description());
        t.setActive(r.active());
        t.setVersion(t.getVersion() + 1);
        t.setUpdatedBy(actor);
        return PromptView.of(prompts.saveAndFlush(t));
    }

    /** One saved version, without its text (a template can be 200 000 characters). */
    public record VersionSummary(int version, String description, boolean active, UUID updatedBy,
                                 String updatedByUsername, Instant createdAt) {
    }

    public record VersionView(int version, String description, boolean active, UUID updatedBy, String updatedByUsername,
                              Instant createdAt, String content) {
    }

    /** {@code expectedVersion} is the current version the user saw, as for an update. */
    public record RestoreRequest(@NotNull Integer expectedVersion) {
    }

    private static final String VERSION_COLUMNS = """
        SELECT v.version, v.description, v.active, v.updated_by, u.username, v.created_at, v.content
        FROM prompt_template_versions v LEFT JOIN users u ON u.id = v.updated_by
        WHERE v.template_id = :id""";

    /** Every saved version, newest first. prompt_template_versions is filled by a database trigger on each save. */
    @Transactional(readOnly = true)
    public List<VersionSummary> versions(UUID id) {
        if (!prompts.existsById(id)) throw notFound();
        return jdbc.query(VERSION_COLUMNS.replace("v.content", "NULL AS content") + " ORDER BY v.version DESC", Map.of("id", id),
            (rs, i) -> new VersionSummary(rs.getInt(1), rs.getString(2), rs.getBoolean(3), rs.getObject(4, UUID.class),
                rs.getString(5), rs.getTimestamp(6).toInstant()));
    }

    @Transactional(readOnly = true)
    public VersionView version(UUID id, int version) {
        return jdbc.query(VERSION_COLUMNS + " AND v.version = :version", Map.of("id", id, "version", version),
                (rs, i) -> new VersionView(rs.getInt(1), rs.getString(2), rs.getBoolean(3), rs.getObject(4, UUID.class),
                    rs.getString(5), rs.getTimestamp(6).toInstant(), rs.getString(7)))
            .stream().findFirst().orElseThrow(() -> ApiException.notFound("PROMPT_NOT_FOUND", "Prompt version not found"));
    }

    /** Saves an old version's text and description again as a new version; the history itself never changes. */
    @Transactional
    public PromptView restore(UUID id, int version, RestoreRequest r, UUID actor) {
        VersionView old = version(id, version);
        PromptTemplate t = prompts.lockById(id).orElseThrow(PromptService::notFound);
        return update(id, new UpdatePrompt(old.content(), old.description(), t.isActive(), r.expectedVersion()), actor);
    }

    private static ApiException notFound() {
        return ApiException.notFound("PROMPT_NOT_FOUND", "Prompt template not found");
    }
}

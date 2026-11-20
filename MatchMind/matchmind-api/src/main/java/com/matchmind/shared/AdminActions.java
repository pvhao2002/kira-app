package com.matchmind.shared;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * The append-only {@code admin_actions} log (V24) and the archive switch shared by providers, models and matches.
 * Callers run inside their own transaction, so the change, its log row and the cache eviction commit together.
 */
@Component
@RequiredArgsConstructor
public class AdminActions {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;

    /** Body of every admin write: why it was done. */
    public record ReasonRequest(@NotBlank @Size(max = 500) String reason) {
    }

    /** Entity kinds of the log; {@code table} and {@code notFound} are fixed strings, never user input. */
    public enum Kind {
        PROVIDER("providers", "PROVIDER_NOT_FOUND", "Provider not found"),
        MODEL("ai_models", "MODEL_NOT_FOUND", "AI model not found"),
        MATCH("matches", "MATCH_NOT_FOUND", "Match not found");

        private final String table, code, message;

        Kind(String table, String code, String message) {
            this.table = table;
            this.code = code;
            this.message = message;
        }

        public ApiException notFound() {
            return ApiException.notFound(code, message);
        }
    }

    /**
     * Archives or unarchives a row and logs it. Returns false (nothing changed, nothing logged) when the row is already
     * in that state. 404 when it does not exist.
     */
    @Transactional
    public boolean setArchived(Kind kind, UUID id, boolean archive, String reason, UUID actor) {
        // FOR UPDATE: two concurrent archives log once.
        var state = jdbc.queryForList("SELECT archived_at IS NOT NULL AS archived FROM " + kind.table + " WHERE id = :id FOR UPDATE",
            new MapSqlParameterSource("id", id));
        if (state.isEmpty()) throw kind.notFound();
        if ((Boolean) state.getFirst().get("archived") == archive) return false;
        jdbc.update("UPDATE " + kind.table + " SET archived_at = " + (archive ? "now()" : "NULL") + " WHERE id = :id",
            new MapSqlParameterSource("id", id));
        record(kind, id, archive ? "ARCHIVE" : "UNARCHIVE", reason, actor, null);
        return true;
    }

    /** One log row; {@code details} (may be null) is stored as a JSON object. */
    @Transactional
    public void record(Kind kind, UUID id, String action, String reason, UUID actor, Map<String, ?> details) {
        String detailsJson;
        try {
            detailsJson = details == null ? null : json.writeValueAsString(details);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("admin action details are not serialisable", e);
        }
        jdbc.update("INSERT INTO admin_actions (entity, entity_id, action, reason, actor, details)"
                + " VALUES (:entity, :id, :action, :reason, :actor, CAST(:details AS jsonb))",
            new MapSqlParameterSource("entity", kind.name()).addValue("id", id).addValue("action", action)
                .addValue("reason", reason.trim()).addValue("actor", actor).addValue("details", detailsJson));
    }
}

package com.kira.memory.message;

import com.kira.memory.identity.CurrentUser;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.kira.memory.shared.Utc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api")
public class MessageController {
    private final JdbcClient jdbc;
    private final LiveEvents events;

    public MessageController(JdbcClient jdbc, LiveEvents events) {
        this.jdbc = jdbc;
        this.events = events;
    }

    public record MessageView(long id, String author, String authorName, String body, Instant createdAt) {
    }

    record Row(long id, String author, String authorName, String body, LocalDateTime createdAt) {
        MessageView view() {
            return new MessageView(id, author, authorName, body, Utc.instant(createdAt));
        }
    }

    public record PostMessage(@NotBlank @Size(max = 2000) String body) {
    }

    private static final String SELECT = """
        SELECT m.id, u.username AS author, u.display_name AS author_name, m.body, m.created_at
        FROM message m JOIN users u ON u.id = m.author_id""";

    /** Newest first; pass the smallest id seen as `before` to page back. */
    @GetMapping("/messages")
    List<MessageView> list(@RequestParam(required = false) Long before, @RequestParam(defaultValue = "50") int limit) {
        return jdbc.sql(SELECT + " WHERE m.id < :before ORDER BY m.id DESC LIMIT :limit")
            .param("before", before == null ? Long.MAX_VALUE : before).param("limit", Math.clamp(limit, 1, 100))
            .query(Row.class).list().stream().map(Row::view).toList();
    }

    @PostMapping("/messages")
    MessageView post(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody PostMessage req) {
        var keys = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO message (author_id, body, created_at) VALUES (?, ?, ?)")
            .params(user.id(), req.body().strip(), Utc.now()).update(keys);
        MessageView view = jdbc.sql(SELECT + " WHERE m.id = ?").param(keys.getKey().longValue())
            .query(Row.class).single().view();
        events.publish("message", view);
        return view;
    }

    @GetMapping(value = "/events", produces = "text/event-stream")
    SseEmitter events(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Accel-Buffering", "no");
        return events.connect();
    }
}

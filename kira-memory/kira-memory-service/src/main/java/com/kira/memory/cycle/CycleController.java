package com.kira.memory.cycle;

import com.kira.memory.identity.CurrentUser;
import com.kira.memory.settings.SettingsController;
import com.kira.memory.shared.ApiException;
import com.kira.memory.shared.Utc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Start days of Em's period ("ngày dâu"): besides messages, the only data the viewer account may change, because
 * she knows the day best. The UI predicts the next start from the gaps. Health data: never logged.
 */
@RestController
@RequestMapping("/api/cycle")
public class CycleController {
    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    private final JdbcClient jdbc;

    public CycleController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Newest first; the last 12 cover a year, more than the prediction needs. */
    public record Cycle(List<LocalDate> starts) {
    }

    public record AddStart(String day) {
    }

    @GetMapping
    Cycle get() {
        return cycle();
    }

    /** Logging a day twice (both of us, or a double tap) keeps one entry. */
    @PostMapping
    Cycle add(@AuthenticationPrincipal CurrentUser user, @RequestBody AddStart req) {
        jdbc.sql("INSERT INTO cycle_start (day, created_by, created_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE day = day")
            .params(day(req.day()), user.id(), Utc.now()).update();
        return cycle();
    }

    @DeleteMapping("/{day}")
    Cycle remove(@PathVariable String day) {
        jdbc.sql("DELETE FROM cycle_start WHERE day = ?").param(day(day)).update();
        return cycle();
    }

    private Cycle cycle() {
        return new Cycle(jdbc.sql("SELECT day FROM cycle_start ORDER BY day DESC LIMIT 12").query(LocalDate.class).list());
    }

    /** A yyyy-MM-dd day from the start of us (14/06/2018) to today in Vietnam. */
    private static LocalDate day(String value) {
        try {
            LocalDate d = value == null ? null : LocalDate.parse(value);
            if (d != null && !d.isBefore(SettingsController.SINCE) && !d.isAfter(LocalDate.now(VIETNAM))) return d;
        } catch (DateTimeParseException ignored) {
            // Not a day at all: the same answer as one out of range.
        }
        throw ApiException.badRequest("INVALID_DAY", "Ngày không hợp lệ");
    }
}

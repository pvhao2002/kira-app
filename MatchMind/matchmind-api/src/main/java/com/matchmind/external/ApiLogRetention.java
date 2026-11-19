package com.matchmind.external;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Deletes external API log rows older than the retention period, so rejected junk calls cannot pile up forever. */
@Component
@RequiredArgsConstructor
public class ApiLogRetention {
    private static final Logger log = LoggerFactory.getLogger(ApiLogRetention.class);
    private final JdbcTemplate jdbc;
    @Value("${app.api-log-retention-days:90}")
    private int days;

    @Scheduled(cron = "0 30 3 * * *")
    public void purge() {
        int deleted = jdbc.update("""
            DELETE FROM external_api_requests e
            WHERE e.received_at < now() - make_interval(days => ?)
              AND NOT EXISTS (SELECT 1 FROM match_result_history h WHERE h.source_request_id = e.id)
            """, days);
        if (deleted > 0) log.info("Deleted {} API log rows older than {} days", deleted, days);
    }
}

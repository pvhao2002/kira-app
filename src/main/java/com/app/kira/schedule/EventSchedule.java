package com.app.kira.schedule;

import com.app.kira.producer.EventProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@Log
@RequiredArgsConstructor
public class EventSchedule {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final EventProducer eventProducer;
    private static final String SQL_GET_EVENT_ANALYST = """
            select event_id
            from event_analyst
            where status = 'pending' or status = 'failed'
            limit 120
            """;

    private static final String SQL_GET_EVENT_UPCOMING = """
            select e.event_id
            from events e
            where true
              and event_date >= CONVERT_TZ(NOW(), 'SYSTEM', '+07:00')
              and (
                false
                    or event_date < CONVERT_TZ(NOW(), 'SYSTEM', '+07:00') + interval 4 hour
                    or e.first_hdc is null
                )
            """;

    @Scheduled(fixedDelay = 10, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    public void crawlOddForUpcomingEvent() {
        var result = jdbcTemplate.query(SQL_GET_EVENT_UPCOMING, (rs, rowNum) -> rs.getString("event_id"));
        result.forEach(eventProducer::sendEventUpcoming);
        log.info("Kira Service >> Scheduled crawl odd for upcoming events, total: " + result.size());
    }

    @Scheduled(fixedDelay = 30, timeUnit = TimeUnit.SECONDS, initialDelay = 1)
    public void event() {
        var result = jdbcTemplate.query(SQL_GET_EVENT_ANALYST, (rs, rowNum) -> rs.getString("event_id"));
        result.forEach(eventProducer::sendEventAnalyst);
        jdbcTemplate.batchUpdate(
                "update event_analyst set status = 'picked' where event_id = :eid",
                result.stream()
                        .map(eid -> new MapSqlParameterSource("eid", eid))
                        .toArray(MapSqlParameterSource[]::new)
        );
        log.info("Kira Service >> Scheduled crawl odd for event analyst, total: " + result.size());
    }
}

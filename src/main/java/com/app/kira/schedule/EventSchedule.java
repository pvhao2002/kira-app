package com.app.kira.schedule;

import com.app.kira.producer.EventProducer;
import com.app.kira.util.PlaywrightUtil;
import com.google.common.collect.Lists;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.Collections;
import java.util.Map;
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
            limit 10000
            """;

    private static final String SQL_GET_EVENT_UPCOMING = """
            select e.event_id
            from events e
            left join crawl_predict_queue cpq on cpq.queue_key = e.event_id and cpq.queue_type = :queue_type
            where true
              and cpq.queue_key is null
              and event_date >= CONVERT_TZ(NOW(), 'SYSTEM', '+07:00')
            --  and event_date < CONVERT_TZ(NOW(), 'SYSTEM', '+07:00') + interval 12 hour
            order by e.event_date
            """;

    @Scheduled(fixedDelay = 20, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    @PostConstruct
    public void crawlOddForUpcomingEvent() {
        var result = jdbcTemplate.query(SQL_GET_EVENT_UPCOMING,
                Map.of("queue_type", PlaywrightUtil.CRAWL_UPCOMING_EVENT),
                (rs, rowNum) -> rs.getString("event_id")
        );
        log.info("Crawling upcoming events: " + result);
        if (CollectionUtils.isEmpty(result)) {
            return;
        }
        Collections.shuffle(result);
        int partSize = (int) Math.ceil(result.size() / 50.0);
        Lists.partition(result, partSize)
                .stream()
                .map(part -> String.join(",", part))
                .forEach(eventProducer::sendEventUpcoming);
        var params = result.stream()
                .map(it -> new MapSqlParameterSource("queue_key", it)
                        .addValue("queue_type", PlaywrightUtil.CRAWL_UPCOMING_EVENT)

                ).toArray(MapSqlParameterSource[]::new);
        jdbcTemplate.batchUpdate(
                """
                        insert ignore into crawl_predict_queue(queue_key, queue_type)
                        VALUES (:queue_key, :queue_type)
                        """,
                params
        );
        log.info("Kira Service >> Scheduled crawl odd for upcoming events, total: " + result.size());
    }

    @Scheduled(fixedDelay = 5, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    public void event() {
        var result = jdbcTemplate.query(SQL_GET_EVENT_ANALYST, (rs, rowNum) -> rs.getString("event_id"));
        if (CollectionUtils.isEmpty(result)) {
            return;
        }
        Lists.partition(result, 50)
                .stream()
                .map(part -> String.join(",", part))
                .forEach(eventProducer::sendEventAnalyst);

        jdbcTemplate.batchUpdate(
                "update event_analyst set status = 'picked' where event_id = :eid",
                result.stream()
                        .map(eid -> new MapSqlParameterSource("eid", eid))
                        .toArray(MapSqlParameterSource[]::new)
        );
        log.info("Kira Service >> Scheduled crawl odd for event analyst, total: " + result.size());
    }
}

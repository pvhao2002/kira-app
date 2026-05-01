package kira.producer.schedule;

import kira.producer.CrawlQueueConstants;
import kira.producer.amqp.EventProducer;
import kira.producer.amqp.QueueBackpressureService;
import kira.producer.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@Log
@RequiredArgsConstructor
@ConditionalOnProperty(name = "kira.producer.crawl-schedule.event-enabled", havingValue = "true", matchIfMissing = true)
public class EventSchedule {
    private static final int QUEUE_MAX_MESSAGES = 200;
    /** Max events per scheduler tick (fail retries first, then fill from {@code events}). */
    private static final int EVENT_BATCH_LIMIT = 200;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final EventProducer eventProducer;
    private final QueueBackpressureService queueBackpressureService;

    /** Retry queue: crawl failures (main / stats / odds). */
    private static final String SQL_GET_EVENT_ANALYST = """
            select distinct f.event_id
            from event_crawl_failed f
            where f.type in (:retry_main, :retry_stats, :retry_odds)
            order by f.event_id
            limit :batch_limit
            """;

    /**
     * Same eligibility as {@code EventClaimRepository} candidate rows (status, no {@code event_no_odds}, no {@code event_odds}),
     * without claim/FOR UPDATE — used to backfill the batch after retries.
     */
    private static final String SQL_GET_EVENTS_NEED_ODDS_BASE = """
            select e.event_id
            from events e
            where e.status not in ('PENDING', 'POSTPONED', 'CANCELLED')
              and not exists (select 1 from event_no_odds eno where eno.event_id = e.event_id)
              and not exists (select 1 from event_odds eo where eo.event_id = e.event_id)
            """;

    private static final String SQL_GET_EVENT_UPCOMING = """
            select e.event_id
            from events e
            left join event_crawl_failed q on q.event_id = e.event_id and q.type = :queue_marker
            where true
              and q.event_id is null
              and not exists (
                    select 1
                    from event_odds eo
                    where eo.event_id = e.event_id
                      and eo.type = 'pre-match'
              )
              and event_date >= CONVERT_TZ(NOW(), 'SYSTEM', '+07:00')
              and event_date < CONVERT_TZ(NOW(), 'SYSTEM', '+07:00') + interval 12 hour
            order by e.event_date
            limit 200
            """;

    @Scheduled(fixedDelay = 20, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    public void crawlOddForUpcomingEvent() {
        if (queueBackpressureService.isQueueOverLimit(RabbitMQConfig.QUEUE_ODD_TOMORROW, QUEUE_MAX_MESSAGES)) {
            log.info("Skip crawlOddForUpcomingEvent because queue " + RabbitMQConfig.QUEUE_ODD_TOMORROW + " has more than " + QUEUE_MAX_MESSAGES + " messages.");
            return;
        }
        var result = jdbcTemplate.query(SQL_GET_EVENT_UPCOMING,
                Map.of("queue_marker", CrawlQueueConstants.UPCOMING_QUEUE_MARKER),
                (rs, rowNum) -> rs.getString("event_id")
        );
        log.info("Crawling upcoming events: " + result);
        if (CollectionUtils.isEmpty(result)) {
            return;
        }
        var queuedEventIds = new ArrayList<>(result);
        Collections.shuffle(queuedEventIds);
        queuedEventIds.forEach(eventProducer::sendEventUpcoming);
        var params = queuedEventIds.stream()
                .map(it -> new MapSqlParameterSource("event_id", it)
                        .addValue("queue_marker", CrawlQueueConstants.UPCOMING_QUEUE_MARKER)
                        .addValue("message", "queued by kira-producer upcoming scheduler")
                ).toArray(MapSqlParameterSource[]::new);
        jdbcTemplate.batchUpdate(
                """
                        insert ignore into event_crawl_failed(event_id, type, message)
                        VALUES (:event_id, :queue_marker, :message)
                        """,
                params
        );
        log.info("kira-producer >> Scheduled crawl odd for upcoming events, total: " + result.size());
    }

    @Scheduled(fixedDelay = 5, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    public void event() {
        if (queueBackpressureService.isQueueOverLimit(RabbitMQConfig.QUEUE_ODD, QUEUE_MAX_MESSAGES)) {
            log.info("Skip event because queue " + RabbitMQConfig.QUEUE_ODD + " has more than " + QUEUE_MAX_MESSAGES + " messages.");
            return;
        }
        var paramsAnalyst = new MapSqlParameterSource()
                .addValue("retry_main", CrawlQueueConstants.RETRY_MAIN)
                .addValue("retry_stats", CrawlQueueConstants.RETRY_STATS)
                .addValue("retry_odds", CrawlQueueConstants.RETRY_ODDS)
                .addValue("batch_limit", EVENT_BATCH_LIMIT);

        List<String> failedRetryIds = jdbcTemplate.query(SQL_GET_EVENT_ANALYST, paramsAnalyst,
                (rs, rowNum) -> rs.getString("event_id"));

        int remaining = EVENT_BATCH_LIMIT - failedRetryIds.size();
        List<String> backfillIds = remaining > 0 ? queryEventsNeedOdds(remaining, failedRetryIds) : List.of();

        var retryEventIds = new ArrayList<String>(failedRetryIds.size() + backfillIds.size());
        retryEventIds.addAll(failedRetryIds);
        retryEventIds.addAll(backfillIds);

        if (retryEventIds.isEmpty()) {
            return;
        }

        retryEventIds.forEach(eventProducer::sendEventAnalyst);

        jdbcTemplate.batchUpdate(
                """
                        delete from event_crawl_failed
                        where event_id = :eid
                          and type in (:retry_main, :retry_stats, :retry_odds)
                        """,
                retryEventIds.stream()
                        .map(eid -> new MapSqlParameterSource("eid", eid)
                                .addValue("retry_main", CrawlQueueConstants.RETRY_MAIN)
                                .addValue("retry_stats", CrawlQueueConstants.RETRY_STATS)
                                .addValue("retry_odds", CrawlQueueConstants.RETRY_ODDS))
                        .toArray(MapSqlParameterSource[]::new)
        );
        log.info("kira-producer >> Scheduled crawl odd for event analyst, total: %d (retry_fail=%d, events_need_odds=%d)"
                .formatted(retryEventIds.size(), failedRetryIds.size(), backfillIds.size()));
    }

    /**
     * Events that still need odds (aligned with gateway claim query filters), excluding IDs already scheduled as retries.
     */
    private List<String> queryEventsNeedOdds(int limit, List<String> excludeEventIds) {
        if (limit <= 0) {
            return List.of();
        }
        MapSqlParameterSource p = new MapSqlParameterSource("lim", limit);
        String sql = SQL_GET_EVENTS_NEED_ODDS_BASE + """
                order by e.event_date asc, e.event_id asc
                limit :lim
                """;
        if (!excludeEventIds.isEmpty()) {
            sql = SQL_GET_EVENTS_NEED_ODDS_BASE + """
                      and e.event_id not in (:excludeIds)
                    order by e.event_date asc, e.event_id asc
                    limit :lim
                    """;
            p.addValue("excludeIds", excludeEventIds);
        }
        return jdbcTemplate.query(sql, p, (rs, rowNum) -> rs.getString("event_id"));
    }
}

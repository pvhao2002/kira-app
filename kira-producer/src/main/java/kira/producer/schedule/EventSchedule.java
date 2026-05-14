package kira.producer.schedule;

import kira.producer.CrawlQueueConstants;
import kira.producer.amqp.EventProducer;
import kira.producer.amqp.QueueBackpressureService;
import kira.producer.config.RabbitMQConfig;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

@Service
@Log
@ConditionalOnProperty(name = "kira.producer.crawl-schedule.event-enabled", havingValue = "true", matchIfMissing = true)
public class EventSchedule {
    private static final int QUEUE_MAX_MESSAGES = 300;
    /** Max events per scheduler tick (fail retries first, then fill from {@code events}). */
    private static final int EVENT_BATCH_LIMIT = 20;
    /** Same table as gateway {@code EventClaimRepository}; blocks duplicate picks while odd job is queued. */
    private static final String EVENT_CLAIM_BY = "kira-producer";

    private static final String SQL_UPSERT_EVENT_CLAIM = """
            insert into event_claim (event_id, claimed_by, claimed_at)
            values (:eventId, :claimedBy, :claimedAt)
            on duplicate key update claimed_by = values(claimed_by),
                                    claimed_at = values(claimed_at)
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final EventProducer eventProducer;
    private final QueueBackpressureService queueBackpressureService;
    private final long claimStaleAfterSeconds;

    public EventSchedule(
            NamedParameterJdbcTemplate jdbcTemplate,
            EventProducer eventProducer,
            QueueBackpressureService queueBackpressureService,
            @Value("${app.crawl.claim-stale-after-seconds:900}") long claimStaleAfterSeconds) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventProducer = eventProducer;
        this.queueBackpressureService = queueBackpressureService;
        this.claimStaleAfterSeconds = Math.max(60L, claimStaleAfterSeconds);
    }

    /**
     * No active {@code event_claim} (none or stale) — same idea as {@code EventClaimRepository#findNextClaimableEventForUpdate}.
     */
    private static final String SQL_FILTER_NO_ACTIVE_CLAIM_FOR_FAILED_EVENT = """
              and not exists (
                select 1 from event_claim ec
                where ec.event_id = f.event_id
                  and timestampdiff(second, ec.claimed_at, now()) < :claimStaleAfterSeconds
              )
            """;

    private static final String SQL_FILTER_NO_ACTIVE_CLAIM_FOR_EVENT = """
              and not exists (
                select 1 from event_claim ec
                where ec.event_id = e.event_id
                  and timestampdiff(second, ec.claimed_at, now()) < :claimStaleAfterSeconds
              )
            """;

    /** Retry queue: crawl failures (main / stats / odds). */
    private static final String SQL_SELECT_FAILED_RETRY_EVENTS_FOR_UPDATE = """
            select distinct f.event_id
            from event_crawl_failed f
            where f.type in (:retry_main, :retry_stats, :retry_odds)
            """ + SQL_FILTER_NO_ACTIVE_CLAIM_FOR_FAILED_EVENT + """
            order by f.event_id
            limit :batch_limit
            for update skip locked
            """;

    /**
     * Same eligibility as {@code EventClaimRepository} candidate rows (status, no missing-odds issue, no {@code event_odds},
     * no active claim) — used to backfill the batch after retries.
     */
    private static final String SQL_SELECT_EVENTS_NEED_ODDS_BASE = """
            select e.event_id
            from events e
            where e.status not in ('PENDING', 'POSTPONED', 'CANCELLED')
              and not exists (
                  select 1 from event_data_issue edi
                  where edi.event_id = e.event_id
                    and edi.issue_type = 'missing_odds'
              )
              and not exists (select 1 from event_odds eo where eo.event_id = e.event_id)
            """ + SQL_FILTER_NO_ACTIVE_CLAIM_FOR_EVENT;

    @Scheduled(fixedDelay = 2, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    @Transactional
    public void event() {
        if (queueBackpressureService.isQueueOverLimit(RabbitMQConfig.QUEUE_ODD, QUEUE_MAX_MESSAGES)) {
            log.info("Skip event because queue " + RabbitMQConfig.QUEUE_ODD + " has more than " + QUEUE_MAX_MESSAGES + " messages.");
            return;
        }
        var paramsAnalyst = new MapSqlParameterSource()
                .addValue("retry_main", CrawlQueueConstants.RETRY_MAIN)
                .addValue("retry_stats", CrawlQueueConstants.RETRY_STATS)
                .addValue("retry_odds", CrawlQueueConstants.RETRY_ODDS)
                .addValue("batch_limit", EVENT_BATCH_LIMIT)
                .addValue("claimStaleAfterSeconds", claimStaleAfterSeconds);

        List<String> failedRetryIds = jdbcTemplate.query(SQL_SELECT_FAILED_RETRY_EVENTS_FOR_UPDATE, paramsAnalyst,
                (rs, rowNum) -> rs.getString("event_id"));

        int remaining = EVENT_BATCH_LIMIT - failedRetryIds.size();
        List<String> backfillIds = remaining > 0 ? queryEventsNeedOdds(remaining, failedRetryIds) : List.of();

        var retryEventIds = new ArrayList<String>(failedRetryIds.size() + backfillIds.size());
        retryEventIds.addAll(failedRetryIds);
        retryEventIds.addAll(backfillIds);

        if (retryEventIds.isEmpty()) {
            return;
        }

        var sentEventIds = new ArrayList<String>(retryEventIds.size());
        for (String eid : retryEventIds) {
            try {
                eventProducer.sendEventAnalyst(eid);
                sentEventIds.add(eid);
            } catch (Exception e) {
                log.log(Level.WARNING, "EventSchedule: failed to send event analyst to queue: " + eid, e);
            }
        }
        if (sentEventIds.isEmpty()) {
            return;
        }

        var claimedAt = LocalDateTime.now();
        jdbcTemplate.batchUpdate(
                SQL_UPSERT_EVENT_CLAIM,
                sentEventIds.stream()
                        .map(eid -> new MapSqlParameterSource("eventId", Long.parseLong(eid))
                                .addValue("claimedBy", EVENT_CLAIM_BY)
                                .addValue("claimedAt", claimedAt))
                        .toArray(MapSqlParameterSource[]::new)
        );

        jdbcTemplate.batchUpdate(
                """
                        delete from event_crawl_failed
                        where event_id = :eid
                          and type in (:retry_main, :retry_stats, :retry_odds)
                        """,
                sentEventIds.stream()
                        .map(eid -> new MapSqlParameterSource("eid", eid)
                                .addValue("retry_main", CrawlQueueConstants.RETRY_MAIN)
                                .addValue("retry_stats", CrawlQueueConstants.RETRY_STATS)
                                .addValue("retry_odds", CrawlQueueConstants.RETRY_ODDS))
                        .toArray(MapSqlParameterSource[]::new)
        );
        log.info("kira-producer >> Scheduled crawl odd for event analyst, total sent: %d of %d (retry_fail=%d, events_need_odds=%d)"
                .formatted(sentEventIds.size(), retryEventIds.size(), failedRetryIds.size(), backfillIds.size()));
    }

    /**
     * Events that still need odds (aligned with gateway claim query filters), excluding IDs already scheduled as retries.
     */
    private List<String> queryEventsNeedOdds(int limit, List<String> excludeEventIds) {
        if (limit <= 0) {
            return List.of();
        }
        MapSqlParameterSource p = new MapSqlParameterSource("lim", limit)
                .addValue("claimStaleAfterSeconds", claimStaleAfterSeconds);
        String sql = SQL_SELECT_EVENTS_NEED_ODDS_BASE + """
                order by e.event_date asc, e.event_id asc
                limit :lim
                for update skip locked
                """;
        if (!excludeEventIds.isEmpty()) {
            sql = SQL_SELECT_EVENTS_NEED_ODDS_BASE + """
                      and e.event_id not in (:excludeIds)
                    order by e.event_date asc, e.event_id asc
                    limit :lim
                    for update skip locked
                    """;
            p.addValue("excludeIds", excludeEventIds);
        }
        return jdbcTemplate.query(sql, p, (rs, rowNum) -> rs.getString("event_id"));
    }
}

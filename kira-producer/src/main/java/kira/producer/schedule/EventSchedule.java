package kira.producer.schedule;

import com.google.common.collect.Lists;
import kira.producer.amqp.EventProducer;
import kira.producer.amqp.QueueBackpressureService;
import kira.producer.config.RabbitMQConfig;
import lombok.extern.java.Log;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

@Service
@Log
@ConditionalOnProperty(name = "kira.producer.crawl-schedule.event-enabled", havingValue = "true", matchIfMissing = true)
public class EventSchedule {
    private static final int QUEUE_MAX_MESSAGES = 1500;
    private static final int FINISHED_BATCH_LIMIT = 1000;
    private static final int LIVE_BATCH_LIMIT = 300;
    private static final int PUBLISH_PARTITION_SIZE = 50;
    private static final String EVENT_CLAIM_BY = "kira-producer";

    private static final String SQL_UPSERT_EVENT_CLAIM = """
            insert into event_claim (event_id, claimed_by, claimed_at)
            values (:eventId, :claimedBy, :claimedAt)
            on duplicate key update claimed_by = values(claimed_by),
                                    claimed_at = values(claimed_at)
            """;

    private static final String SQL_FILTER_NOT_CLAIMED = """
              and not exists (
                select 1 from event_claim ec
                where ec.event_id = e.event_id
              )
            """;

    private static final String SQL_SELECT_FINISHED_EVENTS = """
            select e.event_id
            from events e
            left join aiscore_match_status_ref r
              on r.status_type = 'status_id'
             and r.code = e.status_id
             and r.sport_id = 1
            where e.link is not null
            """ + SQL_FILTER_NOT_CLAIMED + """
              and (
                    (r.ref_id is not null and r.is_terminal = 1 and r.code not in (9, 12))
                 or (e.status_id is null and e.status = 'FT')
              )
            order by e.event_date desc, e.event_id desc
            limit :batch_limit
            for update skip locked
            """;

    private static final String SQL_SELECT_LIVE_EVENTS = """
            select e.event_id
            from events e
            left join aiscore_match_status_ref r
              on r.status_type = 'status_id'
             and r.code = e.status_id
             and r.sport_id = 1
            where e.link is not null
            """ + SQL_FILTER_NOT_CLAIMED + """
              and (
                    (r.ref_id is not null and r.is_in_play = 1)
                 or (e.status_id is null and e.status in ('1H', 'HT', '2H', 'ET', 'Penalties'))
              )
            order by e.event_date asc, e.event_id asc
            limit :batch_limit
            for update skip locked
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final EventProducer eventProducer;
    private final QueueBackpressureService queueBackpressureService;

    public EventSchedule(
            NamedParameterJdbcTemplate jdbcTemplate,
            EventProducer eventProducer,
            QueueBackpressureService queueBackpressureService) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventProducer = eventProducer;
        this.queueBackpressureService = queueBackpressureService;
    }

    @Scheduled(fixedDelay = 10, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    @Transactional
    public void crawlFinishedEvents() {
        publishEvents(
                "crawlFinishedEvents",
                FINISHED_BATCH_LIMIT,
                SQL_SELECT_FINISHED_EVENTS
        );
    }

    @Scheduled(fixedDelay = 5, timeUnit = TimeUnit.MINUTES, initialDelay = 2)
    @Transactional
    public void crawlLiveEvents() {
        publishEvents(
                "crawlLiveEvents",
                LIVE_BATCH_LIMIT,
                SQL_SELECT_LIVE_EVENTS
        );
    }

    private void publishEvents(String jobName, int batchLimit, String selectSql) {
        if (queueBackpressureService.isQueueOverLimit(RabbitMQConfig.QUEUE_ODD, QUEUE_MAX_MESSAGES)) {
            log.info("Skip %s because queue %s has more than %d messages."
                    .formatted(jobName, RabbitMQConfig.QUEUE_ODD, QUEUE_MAX_MESSAGES));
            return;
        }

        var params = new MapSqlParameterSource()
                .addValue("batch_limit", batchLimit);

        List<String> eventIds = jdbcTemplate.query(selectSql, params, (rs, rowNum) -> rs.getString("event_id"));
        if (CollectionUtils.isEmpty(eventIds)) {
            return;
        }

        var sentEventIds = new ArrayList<String>(eventIds.size());
        for (List<String> partition : Lists.partition(eventIds, PUBLISH_PARTITION_SIZE)) {
            String payload = String.join(",", partition);
            try {
                eventProducer.sendEventAnalyst(payload);
                sentEventIds.addAll(partition);
            } catch (Exception e) {
                log.log(Level.WARNING, "EventSchedule >> %s: failed to send batch: %s".formatted(jobName, payload), e);
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

        log.info("kira-producer >> %s: sent %d of %d events in %d batch(es)"
                .formatted(jobName, sentEventIds.size(), eventIds.size(),
                        (sentEventIds.size() + PUBLISH_PARTITION_SIZE - 1) / PUBLISH_PARTITION_SIZE));
    }
}

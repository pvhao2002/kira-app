package kira.producer.schedule;

import kira.producer.amqp.EventProducer;
import kira.producer.amqp.QueueBackpressureService;
import kira.producer.config.RabbitMQConfig;
import kira.producer.service.PredictEnqueueService;
import kira.producer.service.PredictEnqueueService.EnqueueMode;
import kira.producer.service.PredictionSettleEnqueueService;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
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
public class EventSchedule {
    private static final int QUEUE_MAX_MESSAGES = 1500;
    private static final int PREDICT_QUEUE_MAX_MESSAGES = 500;
    private static final int SETTLE_QUEUE_MAX_MESSAGES = 500;
    private static final int FINISHED_BATCH_LIMIT = 1000;
    private static final int LIVE_BATCH_LIMIT = 300;
    private static final int PREDICT_BATCH_LIMIT = 300;
    private static final String EVENT_CLAIM_BY = "kira-producer";

    private static final String SQL_UPSERT_EVENT_CLAIM = """
            insert ignore into event_claim (event_id, claimed_by, claimed_at, status)
            values (:eventId, :claimedBy, :claimedAt, 'processing')
            """;

    private static final String SQL_SELECT_FINISHED_EVENTS = """
            select e.event_id
            from events e
            where e.link is not null
              and e.has_odds
              and not exists (select 1
                              from event_claim ec
                              where ec.event_id = e.event_id
                                and ec.status in ('processing', 'completed', 'skipped'))
              and (e.status = 'FT' or e.status_id in (8, 7, 5, 6))
            order by e.event_date desc, e.event_id desc
            limit :batch_limit
            for update skip locked
            """;

    private static final String SQL_SELECT_LIVE_EVENTS = """
            select event_id
            from events e
            where true
              and e.link is not null
              and e.has_odds
              and e.has_odds_corner
              and e.status_id in (1, 2, 3, 4)
              and e.event_date > date(convert_tz(now(), 'SYSTEM', '+07:00')) - interval 1 second
              and e.event_date < convert_tz(now(), 'SYSTEM', '+07:00') + interval 3 hour
            order by e.event_date, e.event_id
            limit :batch_limit
            for update skip locked
            """;

    private static final String SQL_SELECT_PREDICT_ALL_UPCOMING = """
            select e.event_id
            from events e
            where e.link is not null
              and e.has_odds
              and e.status_id in (1, 2, 3, 4)
              and e.event_date > convert_tz(now(), 'SYSTEM', '+07:00')
            """ + PredictEnqueueService.SQL_FILTER_HAS_HDC_OU_LINES + """
            """ + PredictEnqueueService.SQL_FILTER_NOT_PENDING + """
            """ + PredictEnqueueService.SQL_FILTER_NEEDS_FIRST_PREDICTION + """
            order by e.event_date, e.event_id
            limit :batch_limit
            for update skip locked
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final EventProducer eventProducer;
    private final QueueBackpressureService queueBackpressureService;
    private final PredictEnqueueService predictEnqueueService;
    private final PredictionSettleEnqueueService predictionSettleEnqueueService;
    private final long claimStaleAfterSeconds;
    private final boolean crawlEventEnabled;
    private final boolean predictScheduleEnabled;
    private final boolean allUpcomingEnabled;
    private final boolean nearUpcomingEnabled;
    private final boolean settleScheduleEnabled;
    private final int settleBatchLimit;
    private final String sqlSelectPredictNearUpcoming;

    public EventSchedule(
            NamedParameterJdbcTemplate jdbcTemplate,
            EventProducer eventProducer,
            QueueBackpressureService queueBackpressureService,
            PredictEnqueueService predictEnqueueService,
            PredictionSettleEnqueueService predictionSettleEnqueueService,
            @Value("${kira.producer.claim-stale-after-seconds:${CRAWL_CLAIM_STALE_AFTER_SECONDS:900}}")
            long claimStaleAfterSeconds,
            @Value("${kira.producer.crawl-schedule.event-enabled:${KIRA_PRODUCER_CRAWL_SCHEDULE_EVENT_ENABLED:${KIRA_PRODUCER_CRAWL_SCHEDULE_ENABLED:true}}}")
            boolean crawlEventEnabled,
            @Value("${kira.producer.predict-schedule.enabled:true}")
            boolean predictScheduleEnabled,
            @Value("${kira.producer.predict-schedule.all-upcoming-enabled:true}")
            boolean allUpcomingEnabled,
            @Value("${kira.producer.predict-schedule.near-upcoming-enabled:true}")
            boolean nearUpcomingEnabled,
            @Value("${kira.producer.predict-schedule.near-upcoming-window-hours:3}")
            int nearUpcomingWindowHours,
            @Value("${kira.producer.settle-schedule.enabled:true}")
            boolean settleScheduleEnabled,
            @Value("${kira.producer.settle-schedule.batch-limit:500}")
            int settleBatchLimit) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventProducer = eventProducer;
        this.queueBackpressureService = queueBackpressureService;
        this.predictEnqueueService = predictEnqueueService;
        this.predictionSettleEnqueueService = predictionSettleEnqueueService;
        this.claimStaleAfterSeconds = Math.max(60, claimStaleAfterSeconds);
        this.crawlEventEnabled = crawlEventEnabled;
        this.predictScheduleEnabled = predictScheduleEnabled;
        this.allUpcomingEnabled = allUpcomingEnabled;
        this.nearUpcomingEnabled = nearUpcomingEnabled;
        this.settleScheduleEnabled = settleScheduleEnabled;
        this.settleBatchLimit = Math.max(1, settleBatchLimit);
        int windowHours = Math.max(1, nearUpcomingWindowHours);
        this.sqlSelectPredictNearUpcoming = """
                select e.event_id
                from events e
                where e.link is not null
                  and e.has_odds
                  and e.status_id in (1, 2, 3, 4)
                  and e.event_date > date(convert_tz(now(), 'SYSTEM', '+07:00')) - interval 1 second
                  and e.event_date < convert_tz(now(), 'SYSTEM', '+07:00') + interval %d hour
                """.formatted(windowHours) + PredictEnqueueService.SQL_FILTER_HAS_HDC_OU_LINES + """
                """ + PredictEnqueueService.SQL_FILTER_NOT_PENDING + """
                """ + PredictEnqueueService.SQL_FILTER_NEEDS_REPREDICT_ON_LINE_CHANGE + """
                order by e.event_id
                limit :batch_limit
                for update skip locked
                """;
    }

    @Scheduled(fixedDelay = 1, timeUnit = TimeUnit.MINUTES, initialDelay = 1)
    @Transactional
    public void crawlFinishedEvents() {
        if (!crawlEventEnabled) {
            return;
        }
        publishEvents(
                "crawlFinishedEvents",
                FINISHED_BATCH_LIMIT,
                SQL_SELECT_FINISHED_EVENTS
        );
    }

    @Scheduled(fixedDelay = 10, timeUnit = TimeUnit.MINUTES, initialDelay = 2)
    @Transactional
    public void crawlLiveEvents() {
        if (!crawlEventEnabled) {
            return;
        }
        publishEvents(
                "crawlLiveEvents",
                LIVE_BATCH_LIMIT,
                SQL_SELECT_LIVE_EVENTS
        );
    }

//    @Scheduled(
//            fixedDelayString = "${kira.producer.predict-schedule.all-upcoming-delay-ms:1800000}",
//            initialDelayString = "${kira.producer.predict-schedule.all-upcoming-initial-delay-ms:300000}"
//    )
    @Transactional
    public void predictAllUpcomingEvents() {
        if (!predictScheduleEnabled || !allUpcomingEnabled) {
            return;
        }
        runPredictJob(
                "predictAllUpcomingEvents",
                SQL_SELECT_PREDICT_ALL_UPCOMING,
                EnqueueMode.FIRST_PREDICTION
        );
    }

//    @Scheduled(
//            fixedDelayString = "${kira.producer.predict-schedule.near-upcoming-delay-ms:600000}",
//            initialDelayString = "${kira.producer.predict-schedule.near-upcoming-initial-delay-ms:180000}"
//    )
    @Transactional
    public void predictNearUpcomingEvents() {
        if (!predictScheduleEnabled || !nearUpcomingEnabled) {
            return;
        }
        runPredictJob(
                "predictNearUpcomingEvents",
                sqlSelectPredictNearUpcoming,
                EnqueueMode.REPREDICT
        );
    }

    private void runPredictJob(String jobName, String selectSql, EnqueueMode mode) {
        if (queueBackpressureService.isQueueOverLimit(
                RabbitMQConfig.QUEUE_PREDICTION, PREDICT_QUEUE_MAX_MESSAGES)) {
            log.info("Skip %s because queue %s has more than %d messages."
                    .formatted(jobName, RabbitMQConfig.QUEUE_PREDICTION, PREDICT_QUEUE_MAX_MESSAGES));
            return;
        }

        var queueSize = queueBackpressureService.getQueueSize(RabbitMQConfig.QUEUE_PREDICTION);
        int finalLimit = queueSize == null
                ? PREDICT_BATCH_LIMIT
                : Math.max(0, PREDICT_BATCH_LIMIT - queueSize);
        if (finalLimit == 0) {
            return;
        }

        var params = new MapSqlParameterSource().addValue("batch_limit", finalLimit);
        List<Long> eventIds = jdbcTemplate.query(
                selectSql,
                params,
                (rs, rowNum) -> rs.getLong("event_id")
        );
        if (CollectionUtils.isEmpty(eventIds)) {
            return;
        }

        predictEnqueueService.claimAndEnqueue(jobName, eventIds, mode);
    }

    @Scheduled(
            fixedDelayString = "${kira.producer.settle-schedule.delay-ms:600000}",
            initialDelayString = "${kira.producer.settle-schedule.initial-delay-ms:180000}"
    )
    @Transactional
    public void settleFinishedEvents() {
        if (!settleScheduleEnabled) {
            return;
        }
        if (queueBackpressureService.isQueueOverLimit(
                RabbitMQConfig.QUEUE_PREDICTION_SETTLE, SETTLE_QUEUE_MAX_MESSAGES)) {
            log.info("Skip settleFinishedEvents because queue %s has more than %d messages."
                    .formatted(RabbitMQConfig.QUEUE_PREDICTION_SETTLE, SETTLE_QUEUE_MAX_MESSAGES));
            return;
        }

        var queueSize = queueBackpressureService.getQueueSize(RabbitMQConfig.QUEUE_PREDICTION_SETTLE);
        int finalLimit = queueSize == null
                ? settleBatchLimit
                : Math.max(0, settleBatchLimit - queueSize);
        if (finalLimit == 0) {
            return;
        }

        predictionSettleEnqueueService.enqueueBatch("settleFinishedEvents", finalLimit);
    }

    private void publishEvents(String jobName, int batchLimit, String selectSql) {
        if (queueBackpressureService.isQueueOverLimit(RabbitMQConfig.QUEUE_EVENT, QUEUE_MAX_MESSAGES)) {
            log.info("Skip %s because queue %s has more than %d messages."
                    .formatted(jobName, RabbitMQConfig.QUEUE_EVENT, QUEUE_MAX_MESSAGES));
            return;
        }
        var finalLimit = batchLimit - queueBackpressureService.getQueueSize(RabbitMQConfig.QUEUE_EVENT);

        var params = new MapSqlParameterSource()
                .addValue("batch_limit", finalLimit)
                .addValue("claimStaleAfterSeconds", claimStaleAfterSeconds);

        List<String> eventIds = jdbcTemplate.query(selectSql, params, (rs, rowNum) -> rs.getString("event_id"));
        if (CollectionUtils.isEmpty(eventIds)) {
            return;
        }

        var sentEventIds = new ArrayList<String>(eventIds.size());
        for (String eventId : eventIds) {
            try {
                eventProducer.sendEventAnalyst(eventId);
                sentEventIds.add(eventId);
            } catch (Exception e) {
                log.log(Level.WARNING, "EventSchedule >> %s: failed to send event: %s"
                        .formatted(jobName, eventId), e);
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

        log.info("kira-producer >> %s: sent %d of %d events"
                .formatted(jobName, sentEventIds.size(), eventIds.size()));
    }
}

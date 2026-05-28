package kira.producer.schedule;

import kira.producer.amqp.PredictProducer;
import kira.producer.amqp.QueueBackpressureService;
import kira.producer.config.RabbitMQConfig;
import kira.producer.dto.PredictJobMessage;
import kira.producer.util.PredictionQueueTypes;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

@Service
@Log
@ConditionalOnProperty(name = "kira.producer.predict-schedule.base-data-enabled", havingValue = "true", matchIfMissing = true)
public class BaseDataPredictSchedule {

    private static final int QUEUE_MAX_MESSAGES = 500;

    private static final String SQL_SELECT_EVENTS = """
            select e.event_id
            from events e
                     left join crawl_predict_queue cpq
                               on cpq.queue_key = cast(e.event_id as char)
                                   and cpq.queue_type = :queue_type
            where cpq.queue_key is null
              and coalesce(e.has_odds, 0) = 1
              and e.event_date >= convert_tz(now(), 'SYSTEM', '+07:00') - interval 30 minute
              and e.event_date < convert_tz(now(), 'SYSTEM', '+07:00') + interval 12 hour
              and exists (select 1
                          from event_odds o
                          where o.event_id = e.event_id
                            and o.market = 'hdc'
                            and o.type = 'open'
                            and o.line is not null
                            and o.line <> '')
              and exists (select 1
                          from event_odds o
                          where o.event_id = e.event_id
                            and o.market = 'hdc'
                            and o.type = 'pre-match'
                            and o.line is not null
                            and o.line <> '')
              and exists (select 1
                          from event_odds o
                          where o.event_id = e.event_id
                            and o.market = 'ou'
                            and o.type = 'open'
                            and o.line is not null
                            and o.line <> '')
              and exists (select 1
                          from event_odds o
                          where o.event_id = e.event_id
                            and o.market = 'ou'
                            and o.type = 'pre-match'
                            and o.line is not null
                            and o.line <> '')
            order by e.event_date
            limit 500
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final PredictProducer predictProducer;
    private final QueueBackpressureService queueBackpressureService;

    public BaseDataPredictSchedule(
            NamedParameterJdbcTemplate jdbcTemplate,
            PredictProducer predictProducer,
            QueueBackpressureService queueBackpressureService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.predictProducer = predictProducer;
        this.queueBackpressureService = queueBackpressureService;
    }

    @Scheduled(fixedDelay = 15, initialDelay = 2, timeUnit = TimeUnit.MINUTES)
    public void enqueueBaseDataPredictions() {
        if (queueBackpressureService.isQueueOverLimit(RabbitMQConfig.QUEUE_PREDICTION, QUEUE_MAX_MESSAGES)) {
            log.log(Level.INFO, "Skip Base Data predict scheduling: prediction queue over limit");
            return;
        }

        List<Long> eventIds = jdbcTemplate.query(
                SQL_SELECT_EVENTS,
                Map.of("queue_type", PredictionQueueTypes.PREDICT_BASE_DATA),
                (rs, rowNum) -> rs.getLong("event_id")
        );
        if (CollectionUtils.isEmpty(eventIds)) {
            return;
        }

        log.log(Level.INFO, "Enqueueing Base Data predictions for {0} events", eventIds.size());
        for (Long eventId : eventIds) {
            predictProducer.sendPredict(new PredictJobMessage(eventId, PredictJobMessage.VERSION_BASE_DATA));
        }

        var params = eventIds.stream()
                .map(id -> new MapSqlParameterSource("queue_key", String.valueOf(id))
                        .addValue("queue_type", PredictionQueueTypes.PREDICT_BASE_DATA))
                .toArray(MapSqlParameterSource[]::new);
        jdbcTemplate.batchUpdate(
                """
                        insert ignore into crawl_predict_queue (queue_key, queue_type)
                        values (:queue_key, :queue_type)
                        """,
                params
        );
    }
}

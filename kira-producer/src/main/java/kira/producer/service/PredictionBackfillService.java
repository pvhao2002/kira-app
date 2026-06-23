package kira.producer.service;

import kira.producer.amqp.QueueBackpressureService;
import kira.producer.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class PredictionBackfillService {

    private static final int BACKFILL_BATCH_SIZE = 1000;
    private static final int PREDICT_QUEUE_MAX_MESSAGES = 500;

    private static final String SQL_SELECT_BACKFILL_EVENTS = """
            select e.event_id
            from events e
            where e.event_id > :max_event_id
              and coalesce(e.has_odds, 0) = 1
            """ + PredictEnqueueService.SQL_FILTER_HAS_HDC_OU_LINES + """
            """ + PredictEnqueueService.SQL_FILTER_NOT_PENDING + """
            """ + PredictEnqueueService.SQL_FILTER_NEEDS_FIRST_PREDICTION + """
            order by e.event_id
            limit :batch_limit
            for update skip locked
            """;

    private final PredictEnqueueService predictEnqueueService;
    private final QueueBackpressureService queueBackpressureService;
    private final AtomicBoolean running = new AtomicBoolean(false);

    @Async
    public void enqueueBackfillAll(long startEventId) {
        if (!running.compareAndSet(false, true)) {
            log.info("Prediction backfill skipped: previous run is still active");
            return;
        }

        try {
            long cursor = Math.max(0, startEventId);
            int totalEnqueued = 0;
            int batchNo = 0;

            while (true) {
                if (queueBackpressureService.isQueueOverLimit(
                        RabbitMQConfig.QUEUE_PREDICTION, PREDICT_QUEUE_MAX_MESSAGES)) {
                    log.info("Prediction backfill paused: queue over limit at cursor=" + cursor);
                    break;
                }

                var params = new MapSqlParameterSource()
                        .addValue("max_event_id", cursor)
                        .addValue("batch_limit", BACKFILL_BATCH_SIZE);

                var result = predictEnqueueService.claimAndEnqueueFromQuery(
                        "predictBackfill",
                        SQL_SELECT_BACKFILL_EVENTS,
                        params
                );
                if (result.count() == 0) {
                    break;
                }

                totalEnqueued += result.count();
                batchNo++;
                cursor = result.lastEventId();
                log.log(Level.INFO, "Prediction backfill batch {0}: enqueued {1} events, cursor={2}",
                        new Object[]{batchNo, result.count(), cursor});
            }

            log.log(Level.INFO, "Prediction backfill finished: totalEnqueued={0}, lastCursor={1}",
                    new Object[]{totalEnqueued, cursor});
        } finally {
            running.set(false);
        }
    }
}

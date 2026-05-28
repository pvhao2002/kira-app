package kira.producer.schedule;

import kira.producer.service.PredictionBackfillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "kira.producer.prediction-backfill.enabled", havingValue = "true", matchIfMissing = false)
public class PredictionBackfillSchedule {

    private final PredictionBackfillService predictionBackfillService;

    @Value("${kira.producer.prediction-backfill.batch-size:200}")
    private int batchSize;

    @Scheduled(cron = "${kira.producer.prediction-backfill.cron:0 15 3 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void enqueueNightlyBackfill() {
        int events = predictionBackfillService.enqueueBackfill(batchSize);
        log.log(Level.INFO, "PredictionBackfillSchedule enqueued {0} events", events);
    }
}

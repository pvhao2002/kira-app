package com.queue.kiraqueue.schedule;

import com.queue.kiraqueue.prediction.PredictionBackfillService;
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
@ConditionalOnProperty(name = "kira.queue.prediction-backfill.enabled", havingValue = "true", matchIfMissing = false)
public class PredictionBackfillSchedule {

    private final PredictionBackfillService predictionBackfillService;

    @Value("${kira.queue.prediction-backfill.batch-size:200}")
    private int batchSize;

    @Scheduled(cron = "${kira.queue.prediction-backfill.cron:0 0 3 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void runNightlyBackfill() {
        int processed = predictionBackfillService.backfillBatch(batchSize);
        log.log(Level.INFO, "PredictionBackfillSchedule processed {0} events", processed);
    }
}

package com.queue.kiraqueue.schedule;

import com.queue.kiraqueue.prediction.PredictionSettleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "kira.queue.prediction-settle.enabled", havingValue = "true", matchIfMissing = true)
public class PredictionSettleSchedule {

    private final PredictionSettleService predictionSettleService;

    @Value("${kira.queue.prediction-settle.batch-size:500}")
    private int batchSize;

    @Scheduled(fixedDelay = 10, initialDelay = 3, timeUnit = TimeUnit.MINUTES)
    public void settleCompletedPredictions() {
        int settled = predictionSettleService.settlePending(batchSize);
        if (settled > 0) {
            log.log(Level.INFO, "PredictionSettleSchedule settled {0} predictions", settled);
        }
    }
}

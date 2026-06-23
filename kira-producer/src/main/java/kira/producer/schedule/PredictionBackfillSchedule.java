package kira.producer.schedule;

import kira.producer.service.PredictionBackfillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class PredictionBackfillSchedule {

    private final PredictionBackfillService predictionBackfillService;

    @Value("${kira.producer.predict-schedule.enabled:true}")
    private boolean predictScheduleEnabled;

    @Value("${kira.producer.predict-schedule.backfill-enabled:true}")
    private boolean backfillEnabled;

    @Scheduled(
            fixedDelayString = "${kira.producer.predict-schedule.backfill-delay-ms:3600000}",
            initialDelayString = "${kira.producer.predict-schedule.backfill-initial-delay-ms:600000}"
    )
    public void predictMissingEvents() {
        if (!predictScheduleEnabled || !backfillEnabled) {
            return;
        }
        log.info("Prediction backfill job started");
        predictionBackfillService.enqueueBackfillAll(0);
    }
}

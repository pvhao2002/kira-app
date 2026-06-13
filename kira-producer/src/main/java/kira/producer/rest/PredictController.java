package kira.producer.rest;

import kira.producer.service.PredictionBackfillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/predict")
@RequiredArgsConstructor
public class PredictController {

    private final PredictionBackfillService predictionBackfillService;

    @PostMapping("/backfill")
    public ResponseEntity<Map<String, Object>> backfill(
            @RequestParam(defaultValue = "0") long startEventId
    ) {
        long cursor = Math.max(0, startEventId);
        predictionBackfillService.enqueueBackfillAll(cursor);
        return ResponseEntity.accepted().body(Map.of(
                "status", "accepted",
                "startEventId", cursor
        ));
    }
}

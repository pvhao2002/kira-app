package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.dto.PredictEventResponse;
import com.queue.kiraqueue.dto.PredictUrlRequest;
import com.queue.kiraqueue.dto.PredictUrlResponse;
import com.queue.kiraqueue.service.OnDemandPredictService;
import com.queue.kiraqueue.service.OnDemandUrlPredictService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/predict")
@RequiredArgsConstructor
public class PredictController {

    private final OnDemandPredictService onDemandPredictService;
    private final OnDemandUrlPredictService onDemandUrlPredictService;

    @PostMapping("/events/{eventId}")
    public ResponseEntity<PredictEventResponse> predict(
            @PathVariable long eventId,
            @RequestParam(defaultValue = "false") boolean recrawlOdd
    ) {
        return ResponseEntity.ok(onDemandPredictService.predict(eventId, recrawlOdd));
    }

    @PostMapping("/url")
    public ResponseEntity<PredictUrlResponse> predictByUrl(@RequestBody PredictUrlRequest request) {
        return ResponseEntity.ok(onDemandUrlPredictService.predict(request));
    }
}

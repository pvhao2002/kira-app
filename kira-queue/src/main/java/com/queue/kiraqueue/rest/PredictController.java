package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.dto.PredictEventResponse;
import com.queue.kiraqueue.service.OnDemandPredictService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/predict")
@RequiredArgsConstructor
public class PredictController {

    private final OnDemandPredictService onDemandPredictService;

    @PostMapping("/events/{eventId}")
    public ResponseEntity<PredictEventResponse> predict(
            @PathVariable long eventId,
            @RequestParam(defaultValue = "false") boolean recrawlOdd
    ) {
        return ResponseEntity.ok(onDemandPredictService.predict(eventId, recrawlOdd));
    }
}

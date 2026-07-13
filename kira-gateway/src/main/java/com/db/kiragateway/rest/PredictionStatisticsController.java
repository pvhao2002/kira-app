package com.db.kiragateway.rest;

import com.db.kiragateway.predictionstats.PredictionStatisticsResponse;
import com.db.kiragateway.predictionstats.PredictionStatisticsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/prediction-statistics")
public class PredictionStatisticsController {

    private final PredictionStatisticsService predictionStatisticsService;

    public PredictionStatisticsController(PredictionStatisticsService predictionStatisticsService) {
        this.predictionStatisticsService = predictionStatisticsService;
    }

    @GetMapping
    public PredictionStatisticsResponse get(
            @RequestParam(required = false) Long versionId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return predictionStatisticsService.build(versionId, from, to);
    }
}

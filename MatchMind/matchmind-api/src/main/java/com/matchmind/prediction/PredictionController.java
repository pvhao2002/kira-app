package com.matchmind.prediction;

import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Filters;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/predictions")
@RequiredArgsConstructor
@Tag(name = "Predictions")
public class PredictionController {
    private final PredictionQueryService service;

    /** Shared filters; {@code result} applies to the top pick, or to any pick with {@code resultScope=ANY}. */
    @GetMapping
    public PageResponse<Map<String, Object>> list(Filters filters, @RequestParam(required = false) String resultScope,
                                                  @RequestParam(required = false) Instant kickoffFrom,
                                                  @RequestParam(required = false) Instant kickoffTo,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size,
                                                  @RequestParam(required = false) String sort,
                                                  @RequestParam(defaultValue = "false") boolean liveFirst) {
        return service.list(filters, resultScope, kickoffFrom, kickoffTo, page, size, sort, liveFirst);
    }

    /** Everything stored for one prediction: odds, stats, simulation, picks with settlement history, raw payload. */
    @GetMapping("/{id}")
    public PredictionQueryService.Detail detail(@PathVariable UUID id) {
        return service.detail(id);
    }
}

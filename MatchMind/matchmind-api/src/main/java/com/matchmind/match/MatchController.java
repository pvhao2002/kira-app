package com.matchmind.match;

import com.matchmind.shared.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/matches")
@RequiredArgsConstructor
@Tag(name = "Matches")
public class MatchController {
    private final MatchQueryService service;

    @GetMapping
    public PageResponse<Map<String, Object>> list(@RequestParam(required = false) String search,
                                                  @RequestParam(required = false) String status,
                                                  @RequestParam(required = false) String league,
                                                  @RequestParam(required = false) UUID providerId,
                                                  @RequestParam(required = false) Instant from,
                                                  @RequestParam(required = false) Instant to,
                                                  @RequestParam(required = false) Boolean overdue,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size,
                                                  @RequestParam(required = false) String sort) {
        return service.list(search, status, league, providerId, from, to, overdue, page, size, sort);
    }

    @GetMapping("/leagues")
    public List<String> leagues() {
        return service.leagues();
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable UUID id) {
        return service.detail(id);
    }
}

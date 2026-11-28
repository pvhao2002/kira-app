package com.matchmind.match;

import com.matchmind.match.MatchResultService.AdminResultRequest;
import com.matchmind.match.MatchResultService.ResultResponse;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.AdminActions.ReasonRequest;
import com.matchmind.shared.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final MatchResultService results;
    private final FixtureService fixtures;

    @GetMapping
    public PageResponse<Map<String, Object>> list(@RequestParam(required = false) String search,
                                                  @RequestParam(required = false) String status,
                                                  @RequestParam(required = false) String league,
                                                  @RequestParam(required = false) UUID providerId,
                                                  @RequestParam(required = false) Instant from,
                                                  @RequestParam(required = false) Instant to,
                                                  @RequestParam(required = false) Boolean overdue,
                                                  @RequestParam(required = false) Boolean includeArchived,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size,
                                                  @RequestParam(required = false) String sort) {
        return service.list(search, status, league, providerId, from, to, overdue, includeArchived, page, size, sort);
    }

    @GetMapping("/leagues")
    public List<String> leagues(@RequestParam(required = false) Boolean includeArchived) {
        return Boolean.TRUE.equals(includeArchived) ? service.leaguesIncludingArchived() : service.leagues();
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable UUID id, @RequestParam(required = false) String countPolicy) {
        return service.detail(id, countPolicy);
    }

    /** POST under /api/v1 requires ADMIN in SecurityConfig (there is no write API for matches besides archive and result). */
    @PostMapping("/{id}/archive")
    @Operation(summary = "Hide a match (bad data) from every aggregate and list (admin); returns the match detail")
    public Map<String, Object> archive(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.setArchived(id, true, r.reason(), me.id());
    }

    @PostMapping("/{id}/unarchive")
    public Map<String, Object> unarchive(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.setArchived(id, false, r.reason(), me.id());
    }

    @PostMapping("/{id}/unlink")
    @Operation(summary = "Take a match out of its fixture into a fresh one of its own (admin); returns the match detail")
    public Map<String, Object> unlink(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        fixtures.unlink(id, r.reason(), me.id());
        return service.detail(id);
    }

    @PostMapping("/{id}/result")
    @Operation(summary = "Enter or correct the match result (admin); FINISHED, CANCELLED or POSTPONED settles pending picks")
    public ResultResponse enterResult(@PathVariable UUID id, @Valid @RequestBody AdminResultRequest r,
                                      @AuthenticationPrincipal UserPrincipal me) {
        return results.applyByAdmin(id, r, me.id(), me.username());
    }
}

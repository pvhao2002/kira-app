package com.matchmind.match;

import com.matchmind.match.FixtureService.MergeRequest;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Cross-provider fixtures. POST under /api/v1 requires ADMIN in SecurityConfig. */
@RestController
@RequestMapping("/api/v1/fixtures")
@RequiredArgsConstructor
@Tag(name = "Matches")
public class FixtureController {
    private final FixtureService fixtures;

    @GetMapping("/suggestions")
    @Operation(summary = "Near-duplicate fixtures an admin may merge (same normalised teams or similar names within ±24 h)")
    public PageResponse<Map<String, Object>> suggestions(@RequestParam(required = false) Integer page,
                                                         @RequestParam(required = false) Integer size) {
        return fixtures.suggestions(page, size);
    }

    @PostMapping("/merge")
    @Operation(summary = "Merge matches (and their fixture siblings) into one fixture (admin); results are not touched")
    public Map<String, Object> merge(@Valid @RequestBody MergeRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return fixtures.merge(r, me.id());
    }

    @PostMapping("/backfill")
    @Operation(summary = "Link every match without a fixture (admin, one-off, idempotent)")
    public Map<String, Object> backfill(@AuthenticationPrincipal UserPrincipal me) {
        return fixtures.backfill(me.id());
    }
}

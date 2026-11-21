package com.matchmind.match;

import com.matchmind.match.LeagueAliasService.AliasRequest;
import com.matchmind.match.LeagueAliasService.AliasView;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.AdminActions.ReasonRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** League aliases (UX-086). POST under /api/v1 requires ADMIN in SecurityConfig. */
@RestController
@RequestMapping("/api/v1/leagues/aliases")
@RequiredArgsConstructor
@Tag(name = "Matches")
public class LeagueAliasController {
    private final LeagueAliasService service;

    @GetMapping
    public List<AliasView> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Map a variant league name to a canonical one (admin); filters, dropdown and reports then group them")
    public AliasView add(@Valid @RequestBody AliasRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.add(r, me.id());
    }

    @PostMapping("/{id}/remove")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        service.remove(id, r.reason(), me.id());
    }
}

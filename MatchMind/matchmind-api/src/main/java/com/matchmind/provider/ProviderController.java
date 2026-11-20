package com.matchmind.provider;

import com.matchmind.provider.ProviderService.ProviderView;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.AdminActions.ReasonRequest;
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

import java.util.List;
import java.util.UUID;

/** Providers are created by the first external call that names them in X-Provider; admins can only archive them. */
@RestController
@RequestMapping("/api/v1/providers")
@RequiredArgsConstructor
@Tag(name = "Providers")
public class ProviderController {
    private final ProviderService service;

    @GetMapping
    public List<ProviderView> list(@RequestParam(required = false) Boolean includeArchived) {
        return service.list(includeArchived);
    }

    /** POST under /api/v1 requires ADMIN in SecurityConfig. */
    @PostMapping("/{id}/archive")
    public ProviderView archive(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.setArchived(id, true, r.reason(), me.id());
    }

    @PostMapping("/{id}/unarchive")
    public ProviderView unarchive(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.setArchived(id, false, r.reason(), me.id());
    }
}

package com.matchmind.model;

import com.matchmind.model.AiModelService.MergeRequest;
import com.matchmind.model.AiModelService.ModelView;
import com.matchmind.model.AiModelService.RenameRequest;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.AdminActions.ReasonRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * A model is created the first time an agent sends a prediction with it (X-Model-Name); admins can archive, rename and
 * merge it. Writes need ADMIN (SecurityConfig: every non-GET under /api/v1).
 */
@RestController
@RequestMapping("/api/v1/models")
@RequiredArgsConstructor
@Tag(name = "AI models")
public class AiModelController {
    private final AiModelService service;

    @GetMapping
    public List<ModelView> list(@RequestParam(required = false) UUID providerId,
                                @RequestParam(required = false) Boolean includeArchived,
                                @RequestParam(required = false) String countPolicy) {
        return service.list(providerId, includeArchived, countPolicy);
    }

    @GetMapping("/{id}")
    public ModelView get(@PathVariable UUID id, @RequestParam(required = false) String countPolicy) {
        return service.get(id, countPolicy);
    }

    @PostMapping("/{id}/archive")
    public ModelView archive(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.setArchived(id, true, r.reason(), me.id());
    }

    @PostMapping("/{id}/unarchive")
    public ModelView unarchive(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.setArchived(id, false, r.reason(), me.id());
    }

    @PatchMapping("/{id}")
    public ModelView rename(@PathVariable UUID id, @Valid @RequestBody RenameRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.rename(id, r, me.id());
    }

    @PostMapping("/{id}/merge")
    public ModelView merge(@PathVariable UUID id, @Valid @RequestBody MergeRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.merge(id, r, me.id());
    }

    @PostMapping("/{id}/unmerge")
    public ModelView unmerge(@PathVariable UUID id, @Valid @RequestBody ReasonRequest r, @AuthenticationPrincipal UserPrincipal me) {
        return service.unmerge(id, r.reason(), me.id());
    }
}

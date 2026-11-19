package com.matchmind.prompt;

import com.matchmind.prompt.PromptService.CreatePrompt;
import com.matchmind.prompt.PromptService.PromptView;
import com.matchmind.prompt.PromptService.UpdatePrompt;
import com.matchmind.security.Principals.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/prompts")
@RequiredArgsConstructor
@Tag(name = "Prompt templates")
public class PromptController {
    /** Stored prompts name the agent key only by this placeholder; the key itself never reaches the database. */
    static final String API_KEY_PLACEHOLDER = "{{EXTERNAL_API_KEY}}";
    private final PromptService service;
    @Value("${app.external-api-key:}")
    private String externalApiKey;

    public record AgentPrompt(String content) {
    }

    @GetMapping
    public List<PromptView> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public PromptView get(@PathVariable UUID id) {
        return service.get(id);
    }

    /** What an admin pastes into an agent: the prompt with the shared agent key filled in. Viewers never see the key. */
    @GetMapping("/{id}/for-agent")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Prompt text with the agent API key filled in (admin only)")
    public AgentPrompt forAgent(@PathVariable UUID id) {
        return new AgentPrompt(service.get(id).content().replace(API_KEY_PLACEHOLDER, externalApiKey));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PromptView create(@Valid @RequestBody CreatePrompt r, @AuthenticationPrincipal UserPrincipal me) {
        return service.create(r, me.id());
    }

    @PutMapping("/{id}")
    public PromptView update(@PathVariable UUID id, @Valid @RequestBody UpdatePrompt r, @AuthenticationPrincipal UserPrincipal me) {
        return service.update(id, r, me.id());
    }
}

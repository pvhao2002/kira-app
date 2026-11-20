package com.matchmind.prompt;

import com.matchmind.prompt.PromptService.CreatePrompt;
import com.matchmind.prompt.PromptService.PromptView;
import com.matchmind.prompt.PromptService.RestoreRequest;
import com.matchmind.prompt.PromptService.UpdatePrompt;
import com.matchmind.prompt.PromptService.VersionSummary;
import com.matchmind.prompt.PromptService.VersionView;
import com.matchmind.security.Principals.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
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
    /** The Google Sheet that agents append unsent requests to; empty when none is set up. */
    static final String SHEET_URL_PLACEHOLDER = "{{MATCHMIND_SHEET_URL}}";
    /** The API origin agents call, e.g. https://match.example.org (no trailing slash). */
    static final String BASE_URL_PLACEHOLDER = "{{API_BASE_URL}}";
    private final PromptService service;
    @Value("${app.external-api-key:}")
    private String externalApiKey;
    @Value("${app.matchmind-sheet-url:}")
    private String sheetUrl;
    @Value("${app.public-base-url:}")
    private String publicBaseUrl;

    /** {@code keyRendered} is false when the agent key placeholder is still in the text (viewers, or no key set). */
    public record AgentPrompt(String content, boolean keyRendered) {
    }

    @GetMapping
    public List<PromptView> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public PromptView get(@PathVariable UUID id) {
        return service.get(id);
    }

    /**
     * What a user pastes into an agent: the prompt with the API base URL and the Google Sheet link filled in, and for
     * admins the shared agent key. Viewers never see the key; {@code keyRendered} tells the UI the placeholder is left.
     */
    @GetMapping("/{id}/for-agent")
    @Operation(summary = "Prompt text with the API base URL, the Google Sheet link and (admins only) the agent key filled in")
    public AgentPrompt forAgent(@PathVariable UUID id, @AuthenticationPrincipal UserPrincipal me, HttpServletRequest http) {
        String content = service.get(id).content();
        boolean keyRendered = "ADMIN".equals(me.role()) && !externalApiKey.isBlank();
        // The key goes in first, so a placeholder inside a request header value is never expanded into it.
        if (keyRendered) content = content.replace(API_KEY_PLACEHOLDER, externalApiKey);
        return new AgentPrompt(content.replace(SHEET_URL_PLACEHOLDER, sheetUrl).replace(BASE_URL_PLACEHOLDER, baseUrl(http)),
            keyRendered);
    }

    /** PUBLIC_BASE_URL when set; otherwise the origin the browser used (Host, and X-Forwarded-Proto behind nginx). */
    private String baseUrl(HttpServletRequest http) {
        if (!publicBaseUrl.isBlank()) return publicBaseUrl.replaceAll("/+$", "");
        String proto = http.getHeader("X-Forwarded-Proto");
        String scheme = "https".equalsIgnoreCase(proto) || "http".equalsIgnoreCase(proto) ? proto.toLowerCase() : http.getScheme();
        String host = http.getHeader("Host");
        if (host == null || !host.matches("[A-Za-z0-9.:\\[\\]-]{1,255}")) host = http.getServerName();
        return scheme + "://" + host;
    }

    @GetMapping("/{id}/versions")
    @Operation(summary = "Saved versions of the template, newest first (without their text)")
    public List<VersionSummary> versions(@PathVariable UUID id) {
        return service.versions(id);
    }

    @GetMapping("/{id}/versions/{version}")
    public VersionView version(@PathVariable UUID id, @PathVariable int version) {
        return service.version(id, version);
    }

    @PostMapping("/{id}/versions/{version}/restore")
    @Operation(summary = "Save an old version again as the newest version (admin)")
    public PromptView restore(@PathVariable UUID id, @PathVariable int version, @Valid @RequestBody RestoreRequest r,
                              @AuthenticationPrincipal UserPrincipal me) {
        return service.restore(id, version, r, me.id());
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

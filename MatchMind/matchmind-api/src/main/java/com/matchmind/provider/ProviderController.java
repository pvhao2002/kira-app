package com.matchmind.provider;

import com.matchmind.provider.ProviderKeyService.IssuedKey;
import com.matchmind.provider.ProviderKeyService.KeyView;
import com.matchmind.provider.ProviderService.CreateProvider;
import com.matchmind.provider.ProviderService.ProviderView;
import com.matchmind.provider.ProviderService.UpdateProvider;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.AdminActions.ReasonRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Providers are created by an admin here and get per-provider API keys (the legacy shared key still auto-creates them
 * until the cut-over). Writes need ADMIN (SecurityConfig: non-GET /api/v1/**); the key list is ADMIN only too.
 */
@RestController
@RequestMapping("/api/v1/providers")
@RequiredArgsConstructor
@Tag(name = "Providers")
public class ProviderController {
    private final ProviderService service;
    private final ProviderKeyService keys;

    public record IssueKeyRequest(@Size(max = 128) String label, List<String> scopes) {
    }

    public record RotateKeyRequest(@Size(max = 128) String label) {
    }

    public record ScopesRequest(@NotEmpty List<String> scopes, @NotBlank @Size(max = 500) String reason) {
    }

    @GetMapping
    public List<ProviderView> list(@RequestParam(required = false) Boolean includeArchived) {
        return service.list(includeArchived);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProviderView create(@Valid @RequestBody CreateProvider r) {
        return service.create(r);
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Rename, describe, disable or enable a provider (a status change needs a reason)")
    public ProviderView update(@PathVariable UUID id, @Valid @RequestBody UpdateProvider r, @AuthenticationPrincipal UserPrincipal me) {
        return service.update(id, r, me.id());
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

    @GetMapping("/{id}/keys")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "The provider's API keys (never the secret or its hash)")
    public List<KeyView> keys(@PathVariable UUID id) {
        return keys.list(id);
    }

    @PostMapping("/{id}/keys")
    @Operation(summary = "Issue an API key; the full key is in this response only")
    public ResponseEntity<IssuedKey> issue(@PathVariable UUID id, @Valid @RequestBody IssueKeyRequest r,
                                           @AuthenticationPrincipal UserPrincipal me) {
        return secret(keys.issue(id, r.label(), r.scopes(), me.id()));
    }

    @PostMapping("/{id}/keys/{keyId}/rotate")
    @Operation(summary = "Issue a new key with the same scopes; the old key keeps working until it is revoked")
    public ResponseEntity<IssuedKey> rotate(@PathVariable UUID id, @PathVariable UUID keyId, @Valid @RequestBody RotateKeyRequest r,
                                            @AuthenticationPrincipal UserPrincipal me) {
        return secret(keys.rotate(id, keyId, r.label(), me.id()));
    }

    @PostMapping("/{id}/keys/{keyId}/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable UUID id, @PathVariable UUID keyId, @Valid @RequestBody ReasonRequest r,
                       @AuthenticationPrincipal UserPrincipal me) {
        keys.revoke(id, keyId, r.reason(), me.id());
    }

    @PutMapping("/{id}/keys/{keyId}/scopes")
    @Operation(summary = "Replace a key's scopes, e.g. grant RESULTS to a trusted results feeder")
    public KeyView scopes(@PathVariable UUID id, @PathVariable UUID keyId, @Valid @RequestBody ScopesRequest r,
                          @AuthenticationPrincipal UserPrincipal me) {
        return keys.setScopes(id, keyId, r.scopes(), r.reason(), me.id());
    }

    private static ResponseEntity<IssuedKey> secret(IssuedKey key) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(key);
    }
}

package com.matchmind.external;

import com.matchmind.external.ExternalDtos.PredictionResponse;
import com.matchmind.provider.ProviderService;
import com.matchmind.security.ApiKeyAuthenticationFilter;
import com.matchmind.security.Principals.ProviderPrincipal;
import com.matchmind.shared.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agents running in a sandbox without internet (chat tools) cannot call the API, so they print the request body
 * instead. An admin pastes it here and it goes through exactly the same checks, audit log and live event.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Predictions")
public class PredictionImportController {
    private final ExternalController external;
    private final ProviderService providers;

    @PostMapping(value = "/api/v1/predictions/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Store a prediction JSON that an agent produced but could not send (admin only)")
    public ResponseEntity<PredictionResponse> importPrediction(@RequestParam String provider,
                                                               @RequestParam(required = false) String model,
                                                               @RequestParam(required = false) String modelVersion,
                                                               @RequestBody String body, HttpServletRequest http) {
        String code = ApiKeyAuthenticationFilter.providerCode(provider);
        if (code == null) {
            throw ApiException.badRequest("INVALID_PROVIDER", "Provider must be 2-64 characters: a-z, 0-9, '-' or '_'");
        }
        return external.submitPrediction(new ProviderPrincipal(providers.resolve(code), code), model, modelVersion, body, http);
    }
}

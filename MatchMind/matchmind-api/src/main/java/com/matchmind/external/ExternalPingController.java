package com.matchmind.external;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * Public connectivity test for integrators: no API key (SecurityConfig permits it, ApiKeyAuthenticationFilter skips it),
 * no audit row, no side effects. Not in ExternalController, whose class-level JSON {@code consumes} would answer a GET
 * without Content-Type with 415.
 */
@RestController
@Tag(name = "External AI callbacks")
public class ExternalPingController {
    public static final String PATH = "/api/v1/external/ping";

    public record PingResponse(String status, Instant serverTime) {
    }

    @GetMapping(PATH)
    @Operation(summary = "Public connectivity test: no API key, nothing stored")
    public PingResponse ping() {
        return new PingResponse("ok", Instant.now());
    }
}

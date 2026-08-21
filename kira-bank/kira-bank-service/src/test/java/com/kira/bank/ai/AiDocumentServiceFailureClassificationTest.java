package com.kira.bank.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class AiDocumentServiceFailureClassificationTest {
    private final AiDocumentService service = new AiDocumentService(new AiProviderConfiguration(
        Duration.ofSeconds(5), Duration.ofSeconds(120), Duration.ofMinutes(1)), null, new ObjectMapper(), null);

    @Test
    void authenticationFailureBlocksAccountAndFailsOver() {
        var failure = service.providerFailure(error(HttpStatus.UNAUTHORIZED, null, null));

        assertTrue(failure.failover());
        assertTrue(failure.blocked());
        assertEquals("HTTP_401", failure.code());
    }

    @Test
    void dailyQuotaFailureCoolsAccountUntilNextUtcReset() {
        Instant before = Instant.now();

        var failure = service.providerFailure(error(HttpStatus.TOO_MANY_REQUESTS, "3036", null));

        assertTrue(failure.failover());
        assertFalse(failure.blocked());
        assertEquals("CF_3036", failure.code());
        assertTrue(failure.cooldownUntil().isAfter(before));
        assertTrue(failure.cooldownUntil().isBefore(before.plus(Duration.ofHours(25))));
    }

    @Test
    void accountRateLimitUsesRetryAfter() {
        Instant before = Instant.now();

        var failure = service.providerFailure(error(HttpStatus.TOO_MANY_REQUESTS, "9999", "120"));

        assertTrue(failure.failover());
        assertTrue(failure.cooldownUntil().isAfter(before.plusSeconds(119)));
    }

    @Test
    void providerCapacityAndBadRequestsDoNotFailOver() {
        assertFalse(service.providerFailure(error(HttpStatus.TOO_MANY_REQUESTS, "3040", null)).failover());
        assertFalse(service.providerFailure(error(HttpStatus.BAD_REQUEST, "5004", null)).failover());
    }

    private HttpClientErrorException error(HttpStatus status, String code, String retryAfter) {
        HttpHeaders headers = new HttpHeaders();
        if (retryAfter != null) headers.set(HttpHeaders.RETRY_AFTER, retryAfter);
        String body = code == null ? "{}" : "{\"errors\":[{\"code\":" + code + "}]}";
        return HttpClientErrorException.create(status, status.getReasonPhrase(), headers,
            body.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
    }
}

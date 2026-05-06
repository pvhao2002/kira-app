package com.queue.kiraqueue.client;

import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.lang.management.ManagementFactory;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

@Component
@RequiredArgsConstructor
public class GatewayClaimClient {
    private static final Logger log = Logger.getLogger(GatewayClaimClient.class.getName());
    private final RestClient gatewayRestClient;
    private final Environment environment;
    private final String workerId = buildWorkerId();

    public boolean claimEvent(long eventId) {
        return claim("event", String.valueOf(eventId));
    }

    public boolean releaseEvent(long eventId, boolean success) {
        return release("event", String.valueOf(eventId), success);
    }

    public boolean claimDate(String date) {
        return claim("date", date);
    }

    public boolean releaseDate(String date, boolean success) {
        return release("date", date, success);
    }

    private boolean claim(String type, String resourceId) {
        if (!isClaimEnabled()) {
            return true;
        }
        try {
            var response = gatewayRestClient.post()
                    .uri("/crawl/claim/{type}", type)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "resourceId", resourceId,
                            "workerId", workerId,
                            "source", "queue",
                            "ttlSeconds", 300
                    ))
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            if (response == null || !"ok".equals(response.get("status"))) {
                return false;
            }
            @SuppressWarnings("unchecked")
            var data = (Map<String, Object>) response.get("data");
            if (data == null) {
                return false;
            }
            return Boolean.TRUE.equals(data.get("granted"));
        } catch (Exception e) {
            log.log(Level.WARNING, "claim failed: type=%s resourceId=%s error=%s".formatted(type, resourceId, e.getMessage()));
            return false;
        }
    }

    private boolean release(String type, String resourceId, boolean success) {
        if (!isClaimEnabled()) {
            return true;
        }
        try {
            var response = gatewayRestClient.post()
                    .uri("/crawl/claim/{type}/release", type)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "resourceId", resourceId,
                            "workerId", workerId,
                            "success", success
                    ))
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            if (response == null || !"ok".equals(response.get("status"))) {
                return false;
            }
            return Optional.ofNullable(response.get("released")).map(Boolean.class::cast).orElse(false);
        } catch (Exception e) {
            log.log(Level.WARNING, "release failed: type=%s resourceId=%s error=%s".formatted(type, resourceId, e.getMessage()));
            return false;
        }
    }

    private String buildWorkerId() {
        String env = System.getenv("INSTANCE_ID");
        if (env != null && !env.isBlank()) {
            return env.trim();
        }
        String pid = ManagementFactory.getRuntimeMXBean().getName();
        return "queue-" + pid + "-" + UUID.randomUUID().toString().substring(0, 6);
    }

    private boolean isClaimEnabled() {
        return environment.getProperty("app.claim.enabled", Boolean.class, true);
    }
}

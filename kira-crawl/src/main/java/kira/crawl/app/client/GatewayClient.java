package kira.crawl.app.client;

import kira.crawl.app.dto.CrawledEventDTO;
import kira.crawl.app.dto.EventInfoResponse;
import kira.crawl.app.dto.OddsTimelineItemDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Level;

@Log
@Component
@RequiredArgsConstructor
public class GatewayClient {

    private final RestClient gatewayRestClient;

    public void updateCrawlDateStatus(String date, String status, int totalEvents, String message) {
        try {
            gatewayRestClient.put()
                    .uri("/crawl/dates/{date}/status", date)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("status", status, "totalEvents", totalEvents, "message", message != null ? message : ""))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.log(Level.WARNING, "updateCrawlDateStatus failed: date=%s, status=%s, error=%s".formatted(date, status, e.getMessage()));
        }
    }

    public void persistCrawledEvents(List<CrawledEventDTO> events) {
        try {
            gatewayRestClient.post()
                    .uri("/crawl/events")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("events", events))
                    .retrieve()
                    .toBodilessEntity();
            log.info("persistCrawledEvents: sent %d events to gateway".formatted(events.size()));
        } catch (Exception e) {
            log.log(Level.SEVERE, "persistCrawledEvents failed: %s".formatted(e.getMessage()));
            throw new RuntimeException("Failed to persist crawled events via gateway", e);
        }
    }

    public Optional<EventInfoResponse> getEventInfo(long eventId) {
        try {
            var response = gatewayRestClient.get()
                    .uri("/events/{eventId}", eventId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            if (response == null || !"ok".equals(response.get("status"))) {
                return Optional.empty();
            }
            @SuppressWarnings("unchecked")
            var data = (Map<String, Object>) response.get("data");
            if (data == null) return Optional.empty();
            return Optional.of(new EventInfoResponse(
                    ((Number) data.get("eventId")).longValue(),
                    (String) data.get("link"),
                    (String) data.get("eventName")
            ));
        } catch (Exception e) {
            log.log(Level.WARNING, "getEventInfo failed: eventId=%d, error=%s".formatted(eventId, e.getMessage()));
            return Optional.empty();
        }
    }

    public void persistEventStats(long eventId, Map<String, int[]> htStats, Map<String, int[]> ftStats) {
        try {
            gatewayRestClient.post()
                    .uri("/crawl/events/{eventId}/stats", eventId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("htStats", htStats, "ftStats", ftStats))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.log(Level.WARNING, "persistEventStats failed: eventId=%d, error=%s".formatted(eventId, e.getMessage()));
            throw new RuntimeException("Failed to persist event stats via gateway", e);
        }
    }

    public void deleteEventOdds(long eventId) {
        try {
            gatewayRestClient.delete()
                    .uri("/crawl/events/{eventId}/odds", eventId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.log(Level.WARNING, "deleteEventOdds failed: eventId=%d, error=%s".formatted(eventId, e.getMessage()));
        }
    }

    public void persistEventOdds(long eventId, String market, List<OddsTimelineItemDTO> timeline) {
        try {
            gatewayRestClient.post()
                    .uri("/crawl/events/{eventId}/odds", eventId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("market", market, "timeline", timeline))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.log(Level.WARNING, "persistEventOdds failed: eventId=%d, market=%s, error=%s".formatted(eventId, market, e.getMessage()));
            throw new RuntimeException("Failed to persist event odds via gateway", e);
        }
    }

    public void reportCrawlFail(long eventId, String type, String message) {
        try {
            gatewayRestClient.post()
                    .uri("/crawl/events/{eventId}/fail", eventId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("type", type, "message", message))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.log(Level.WARNING, "reportCrawlFail failed: eventId=%d, error=%s".formatted(eventId, e.getMessage()));
        }
    }

    public void clearCrawlFail(long eventId) {
        try {
            gatewayRestClient.delete()
                    .uri("/crawl/events/{eventId}/fail", eventId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.log(Level.WARNING, "clearCrawlFail failed: eventId=%d, error=%s".formatted(eventId, e.getMessage()));
        }
    }

    public Optional<Long> claimNextEvent(String instanceId) {
        try {
            var response = gatewayRestClient.get()
                    .uri("/events/claim/next?instanceId={instanceId}", instanceId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            if (response == null || !"ok".equals(response.get("status"))) {
                return Optional.empty();
            }
            @SuppressWarnings("unchecked")
            var data = (Map<String, Object>) response.get("data");
            if (data == null) return Optional.empty();
            return Optional.of(((Number) data.get("eventId")).longValue());
        } catch (Exception e) {
            log.log(Level.WARNING, "claimNextEvent failed: instanceId=%s, error=%s".formatted(instanceId, e.getMessage()));
            return Optional.empty();
        }
    }
}

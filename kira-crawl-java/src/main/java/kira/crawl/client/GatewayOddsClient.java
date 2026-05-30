package kira.crawl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import kira.crawl.dto.MatchOddsResponseDto;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "app.odds-crawl-job.enabled", havingValue = "true")
public class GatewayOddsClient {

    private final RestClient gatewayRestClient;

    public GatewayOddsClient(RestClient gatewayRestClient) {
        this.gatewayRestClient = gatewayRestClient;
    }

    public Optional<ClaimedOddsEventDto> claimNext(String instanceId) {
        return gatewayRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/crawl/odds/claim/next")
                        .queryParam("instanceId", instanceId)
                        .build())
                .exchange((request, response) -> {
                    if (response.getStatusCode().value() == 204) {
                        return Optional.empty();
                    }
                    var body = response.bodyTo(ClaimNextResponse.class);
                    if (body == null || body.data() == null) {
                        return Optional.empty();
                    }
                    return Optional.of(body.data());
                });
    }

    public void submitResult(long eventId, MatchOddsResponseDto result) {
        var payload = new CrawlOddsResultPayload(
                result.matchId(),
                result.event(),
                result.eventResult(),
                result.odds(),
                result.oddsTimeline()
        );
        gatewayRestClient.post()
                .uri("/crawl/odds/events/{eventId}/result", eventId)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
    }

    public void reportFail(long eventId, String type, String message) {
        gatewayRestClient.post()
                .uri("/crawl/events/{eventId}/fail", eventId)
                .body(Map.of("type", type, "message", message != null ? message : ""))
                .retrieve()
                .toBodilessEntity();
    }

    public void recordNoOdds(long eventId) {
        gatewayRestClient.post()
                .uri("/crawl/events/{eventId}/no-odds", eventId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new IllegalStateException("recordNoOdds failed for eventId=" + eventId
                            + " status=" + res.getStatusCode());
                })
                .toBodilessEntity();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ClaimNextResponse(String status, ClaimedOddsEventDto data) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ClaimedOddsEventDto(
            long eventId,
            String externalId,
            Integer leagueId,
            Integer homeId,
            Integer awayId,
            String eventName,
            String status,
            String link,
            Boolean hasOddsCorner,
            String claimedBy
    ) {
    }

    private record CrawlOddsResultPayload(
            String matchId,
            Object event,
            Object eventResult,
            Object odds,
            Object oddsTimeline
    ) {
    }
}

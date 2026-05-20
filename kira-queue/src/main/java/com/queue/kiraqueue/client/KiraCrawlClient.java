package com.queue.kiraqueue.client;

import com.queue.kiraqueue.dto.crawl.MatchOddsResponse;
import com.queue.kiraqueue.dto.crawl.MatchesResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
public class KiraCrawlClient {

    private final RestClient kiraCrawlRestClient;

    public MatchesResponse fetchMatches(String date) {
        var uri = UriComponentsBuilder.fromPath("/matches")
                .queryParam("date", date)
                .queryParam("sport_id", 1)
                .queryParam("lang", 2)
                .queryParam("tz", "07:00")
                .build()
                .toUri();

        var response = kiraCrawlRestClient.get()
                .uri(uri)
                .retrieve()
                .body(MatchesResponse.class);

        if (response == null) {
            throw new IllegalStateException("Empty response from kira-crawl for date=" + date);
        }
        return response;
    }

    public MatchOddsResponse fetchMatchOdds(String eventLink) {
        if (!StringUtils.hasText(eventLink)) {
            throw new IllegalArgumentException("eventLink is required");
        }

        var uri = UriComponentsBuilder.fromPath("/matches/odds")
                .queryParam("event_link", eventLink)
                .build()
                .toUri();

        var response = kiraCrawlRestClient.get()
                .uri(uri)
                .retrieve()
                .body(MatchOddsResponse.class);

        if (response == null) {
            return new MatchOddsResponse(null, null, null, null, null);
        }
        return response;
    }
}

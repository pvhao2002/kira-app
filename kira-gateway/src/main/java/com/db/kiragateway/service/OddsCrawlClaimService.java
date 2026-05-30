package com.db.kiragateway.service;

import com.db.kiragateway.repository.EventClaimRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class OddsCrawlClaimService {

    private final EventClaimRepository eventClaimRepository;
    private final long claimStaleAfterSeconds;

    public OddsCrawlClaimService(EventClaimRepository eventClaimRepository,
                                 @Value("${app.crawl.claim-stale-after-seconds:900}") long claimStaleAfterSeconds) {
        this.eventClaimRepository = eventClaimRepository;
        this.claimStaleAfterSeconds = Math.max(60, claimStaleAfterSeconds);
    }

    @Transactional
    public Optional<ClaimedOddsEvent> claimNextOddsEvent(String instanceId) {
        var candidate = eventClaimRepository.findNextOddsClaimableEventForUpdate(claimStaleAfterSeconds);
        if (candidate.isEmpty()) {
            return Optional.empty();
        }

        var event = candidate.get();
        var claimedAt = LocalDateTime.now();
        eventClaimRepository.insertClaim(event.eventId(), instanceId, claimedAt);

        return Optional.of(new ClaimedOddsEvent(
                event.eventId(),
                event.externalId(),
                event.leagueId(),
                event.homeId(),
                event.awayId(),
                event.eventName(),
                event.eventDate(),
                event.status(),
                event.link(),
                event.hasOddsCorner(),
                instanceId,
                claimedAt
        ));
    }

    public record ClaimedOddsEvent(
            long eventId,
            String externalId,
            Integer leagueId,
            Integer homeId,
            Integer awayId,
            String eventName,
            LocalDateTime eventDate,
            String status,
            String link,
            Boolean hasOddsCorner,
            String claimedBy,
            LocalDateTime claimedAt
    ) {
    }
}

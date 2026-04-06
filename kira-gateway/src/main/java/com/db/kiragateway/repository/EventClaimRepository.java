package com.db.kiragateway.repository;

import com.db.kiragateway.config.db.WriteDB;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public class EventClaimRepository {

    private final JdbcClient writeJdbcClient;

    public EventClaimRepository(@WriteDB JdbcClient writeJdbcClient) {
        this.writeJdbcClient = writeJdbcClient;
    }

    public Optional<EventCandidate> findNextClaimableEventForUpdate(long claimStaleAfterSeconds) {
        var sql = """
                select e.event_id,
                       e.external_id,
                       e.league_id,
                       e.home_id,
                       e.away_id,
                       e.event_name,
                       e.event_date,
                       e.status,
                       e.link
                from events e
                left join event_claim ec on ec.event_id = e.event_id
                where ec.event_id is null
                   or timestampdiff(second, ec.claimed_at, now()) >= :claimStaleAfterSeconds
                order by e.event_date asc, e.event_id asc
                limit 1
                for update skip locked
                """;

        return writeJdbcClient
                .sql(sql)
                .param("claimStaleAfterSeconds", claimStaleAfterSeconds)
                .query((rs, rowNum) -> new EventCandidate(
                        rs.getLong("event_id"),
                        rs.getString("external_id"),
                        rs.getObject("league_id", Integer.class),
                        rs.getObject("home_id", Integer.class),
                        rs.getObject("away_id", Integer.class),
                        rs.getString("event_name"),
                        rs.getObject("event_date", LocalDateTime.class),
                        rs.getString("status"),
                        rs.getString("link")
                ))
                .optional();
    }

    public int insertClaim(long eventId, String claimedBy, LocalDateTime claimedAt) {
        var sql = """
                insert into event_claim (event_id, claimed_by, claimed_at)
                values (:eventId, :claimedBy, :claimedAt)
                on duplicate key update claimed_by = values(claimed_by),
                                        claimed_at = values(claimed_at)
                """;

        return writeJdbcClient
                .sql(sql)
                .param("eventId", eventId)
                .param("claimedBy", claimedBy)
                .param("claimedAt", claimedAt)
                .update();
    }

    public record EventCandidate(
            long eventId,
            String externalId,
            Integer leagueId,
            Integer homeId,
            Integer awayId,
            String eventName,
            LocalDateTime eventDate,
            String status,
            String link
    ) {
    }
}

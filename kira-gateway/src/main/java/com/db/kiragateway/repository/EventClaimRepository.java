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
                where (ec.event_id is null
                   or ec.status = 'failed'
                   or (
                        ec.status = 'processing'
                    and timestampdiff(second, ec.claimed_at, now()) >= :claimStaleAfterSeconds
                      ))
                  and e.status not in ('PENDING', 'POSTPONED', 'CANCELLED')
                  and not exists (
                      select 1 from event_data_issue edi
                      where edi.event_id = e.event_id
                        and edi.issue_type = 'missing_odds'
                  )
                  and not exists (
                      select 1 from event_odds eo
                      where eo.event_id = e.event_id
                  )
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

    public void insertClaim(long eventId, String claimedBy, LocalDateTime claimedAt) {
        var sql = """
                insert into event_claim (event_id, claimed_by, claimed_at, status)
                values (:eventId, :claimedBy, :claimedAt, 'processing')
                on duplicate key update claimed_by = values(claimed_by),
                                        claimed_at = values(claimed_at),
                                        status = 'processing'
                """;

        writeJdbcClient
                .sql(sql)
                .param("eventId", eventId)
                .param("claimedBy", claimedBy)
                .param("claimedAt", claimedAt)
                .update();
    }

    /**
     * Mark claim failed so the event can be picked again (e.g. after crawl failure).
     */
    public int markFailedByEventId(long eventId) {
        return writeJdbcClient
                .sql("""
                        UPDATE event_claim
                        SET status = 'failed'
                        WHERE event_id = :eventId
                        """)
                .param("eventId", eventId)
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

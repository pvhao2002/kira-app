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

    private static final String SQL_FILTER_NOT_CLAIMED = """
              and (ec.event_id is null
                   or ec.status = 'failed'
                   or (
                        ec.status = 'processing'
                    and timestampdiff(second, ec.claimed_at, now()) >= :claimStaleAfterSeconds
                      ))
            """;

    private static final String SQL_FILTER_EXCLUDE_PRODUCER_EVENTS = """
              and not (
                    coalesce(e.has_odds, 0) = 1
                and (
                        (r.ref_id is not null and r.is_terminal = 1 and r.code not in (9, 12))
                     or (e.status_id is null and e.status = 'FT')
                     or (r.ref_id is not null and r.is_in_play = 1)
                     or (e.status_id is null and e.status in ('1H', 'HT', '2H', 'ET', 'Penalties'))
                    )
              )
            """;

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

    public Optional<OddsEventCandidate> findNextOddsClaimableEventForUpdate(long claimStaleAfterSeconds) {
        var sql = """
                select e.event_id,
                       e.external_id,
                       e.league_id,
                       e.home_id,
                       e.away_id,
                       e.event_name,
                       e.event_date,
                       e.status,
                       e.link,
                       e.has_odds_corner
                from events e
                left join event_claim ec on ec.event_id = e.event_id
                left join aiscore_match_status_ref r
                  on r.status_type = 'status_id'
                 and r.code = e.status_id
                 and r.sport_id = 1
                where e.link is not null
                """ + SQL_FILTER_NOT_CLAIMED + """
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
                """ + SQL_FILTER_EXCLUDE_PRODUCER_EVENTS + """
                order by e.event_date asc, e.event_id asc
                limit 1
                for update skip locked
                """;

        return writeJdbcClient
                .sql(sql)
                .param("claimStaleAfterSeconds", claimStaleAfterSeconds)
                .query((rs, rowNum) -> new OddsEventCandidate(
                        rs.getLong("event_id"),
                        rs.getString("external_id"),
                        rs.getObject("league_id", Integer.class),
                        rs.getObject("home_id", Integer.class),
                        rs.getObject("away_id", Integer.class),
                        rs.getString("event_name"),
                        rs.getObject("event_date", LocalDateTime.class),
                        rs.getString("status"),
                        rs.getString("link"),
                        rs.getObject("has_odds_corner", Boolean.class)
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

    public int completeClaimByEventId(long eventId) {
        return writeJdbcClient
                .sql("""
                        UPDATE event_claim
                        SET status = 'completed'
                        WHERE event_id = :eventId
                        """)
                .param("eventId", eventId)
                .update();
    }

    public int releaseClaimByEventId(long eventId) {
        return writeJdbcClient
                .sql("DELETE FROM event_claim WHERE event_id = :eventId")
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

    public record OddsEventCandidate(
            long eventId,
            String externalId,
            Integer leagueId,
            Integer homeId,
            Integer awayId,
            String eventName,
            LocalDateTime eventDate,
            String status,
            String link,
            Boolean hasOddsCorner
    ) {
    }
}

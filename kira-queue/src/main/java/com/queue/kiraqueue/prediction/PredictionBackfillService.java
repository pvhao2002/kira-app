package com.queue.kiraqueue.prediction;

import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class PredictionBackfillService {

    private static final String SQL_SELECT_FINISHED_EVENTS = """
            select e.event_id
            from events e
                     inner join event_result er on er.event_id = e.event_id
            where er.ft_home_goal is not null
              and er.ft_away_goal is not null
              and (
                    exists (select 1
                            from aiscore_match_status_ref r
                            where r.status_type = 'status_id'
                              and r.code = e.status_id
                              and r.sport_id = 1
                              and r.is_terminal = 1
                              and r.code not in (9, 12))
                    or (e.status_id is null and e.status = 'FT')
                )
              and exists (select 1
                          from event_odds o
                          where o.event_id = e.event_id
                            and o.market = 'hdc'
                            and o.type = 'open'
                            and o.line is not null
                            and o.line <> '')
              and exists (select 1
                          from event_odds o
                          where o.event_id = e.event_id
                            and o.market = 'hdc'
                            and o.type = 'pre-match'
                            and o.line is not null
                            and o.line <> '')
              and exists (select 1
                          from event_odds o
                          where o.event_id = e.event_id
                            and o.market = 'ou'
                            and o.type = 'open'
                            and o.line is not null
                            and o.line <> '')
              and exists (select 1
                          from event_odds o
                          where o.event_id = e.event_id
                            and o.market = 'ou'
                            and o.type = 'pre-match'
                            and o.line is not null
                            and o.line <> '')
            order by e.event_date desc, e.event_id desc
            limit :limit
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final BaseDataPredictionEngine baseDataPredictionEngine;
    private final OddsMovementPredictionEngine oddsMovementPredictionEngine;
    private final PredictionSettleService predictionSettleService;

    public int backfillBatch(int limit) {
        List<Long> eventIds = jdbcTemplate.query(
                SQL_SELECT_FINISHED_EVENTS,
                Map.of("limit", limit),
                (rs, rowNum) -> rs.getLong("event_id")
        );
        if (eventIds.isEmpty()) {
            return 0;
        }

        log.log(Level.INFO, "Prediction backfill starting for {0} events", eventIds.size());
        int processed = 0;
        for (Long eventId : eventIds) {
            try {
                baseDataPredictionEngine.predict(eventId);
                oddsMovementPredictionEngine.predict(eventId);
                predictionSettleService.settleEvent(eventId);
                processed++;
            } catch (Exception ex) {
                log.log(Level.WARNING, "Prediction backfill failed for event_id=" + eventId + ": " + ex.getMessage());
            }
        }
        log.log(Level.INFO, "Prediction backfill completed for {0} events", processed);
        return processed;
    }
}

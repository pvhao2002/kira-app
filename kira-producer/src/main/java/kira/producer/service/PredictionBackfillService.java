package kira.producer.service;

import kira.producer.amqp.PredictProducer;
import kira.producer.dto.PredictJobMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.logging.Level;

/**
 * Enqueues prediction jobs for finished events (async via RabbitMQ).
 * Settlement runs in kira-queue ({@code PredictionSettleSchedule}).
 * For synchronous full backfill, use kira-queue {@code PredictionBackfillService}.
 */
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
              and exists (select 1 from event_odds o where o.event_id = e.event_id and o.market = 'hdc' and o.type = 'open' and o.line is not null and o.line <> '')
              and exists (select 1 from event_odds o where o.event_id = e.event_id and o.market = 'hdc' and o.type = 'pre-match' and o.line is not null and o.line <> '')
              and exists (select 1 from event_odds o where o.event_id = e.event_id and o.market = 'ou' and o.type = 'open' and o.line is not null and o.line <> '')
              and exists (select 1 from event_odds o where o.event_id = e.event_id and o.market = 'ou' and o.type = 'pre-match' and o.line is not null and o.line <> '')
            order by e.event_date desc, e.event_id desc
            limit :limit
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final PredictProducer predictProducer;

    public int enqueueBackfill(int limit) {
        List<Long> eventIds = jdbcTemplate.query(
                SQL_SELECT_FINISHED_EVENTS,
                Map.of("limit", limit),
                (rs, rowNum) -> rs.getLong("event_id")
        );
        for (Long eventId : eventIds) {
            predictProducer.sendPredict(new PredictJobMessage(eventId, PredictJobMessage.VERSION_BASE_DATA));
            predictProducer.sendPredict(new PredictJobMessage(eventId, PredictJobMessage.VERSION_ODDS_MOVEMENT));
        }
        log.log(Level.INFO, "Enqueued prediction backfill for {0} events ({1} jobs)", new Object[]{
                eventIds.size(), eventIds.size() * 2
        });
        return eventIds.size();
    }
}

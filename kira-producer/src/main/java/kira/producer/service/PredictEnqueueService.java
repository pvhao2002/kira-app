package kira.producer.service;

import kira.producer.amqp.PredictProducer;
import kira.producer.dto.PredictJobMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.CollectionUtils;

import java.util.List;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class PredictEnqueueService {

    public static final String SQL_FILTER_NOT_PENDING = "";

    public static final String SQL_LINES_CHANGED = """
                coalesce(ep.open_hdc_line, '') <> coalesce((
                  select o.line
                  from event_odds o
                  where o.event_id = ep.event_id
                    and o.market = 'hdc'
                    and o.type = 'open'
                    and o.line is not null
                    and o.line <> ''
                  limit 1
                ), '')
                or coalesce(ep.prematch_hdc_line, '') <> coalesce((
                  select o.line
                  from event_odds o
                  where o.event_id = ep.event_id
                    and o.market = 'hdc'
                    and o.type = 'pre-match'
                    and o.line is not null
                    and o.line <> ''
                  limit 1
                ), '')
                or coalesce(ep.open_ou_line, '') <> coalesce((
                  select o.line
                  from event_odds o
                  where o.event_id = ep.event_id
                    and o.market = 'ou'
                    and o.type = 'open'
                    and o.line is not null
                    and o.line <> ''
                  limit 1
                ), '')
                or coalesce(ep.prematch_ou_line, '') <> coalesce((
                  select o.line
                  from event_odds o
                  where o.event_id = ep.event_id
                    and o.market = 'ou'
                    and o.type = 'pre-match'
                    and o.line is not null
                    and o.line <> ''
                  limit 1
                ), '')
                or (
                  exists (
                    select 1
                    from event_odds o
                    where o.event_id = ep.event_id
                      and o.market = 'corner'
                      and o.type = 'open'
                      and o.line is not null
                      and o.line <> ''
                  )
                  and (
                    coalesce(ep.open_corner_line, '') <> coalesce((
                      select o.line
                      from event_odds o
                      where o.event_id = ep.event_id
                        and o.market = 'corner'
                        and o.type = 'open'
                        and o.line is not null
                        and o.line <> ''
                      limit 1
                    ), '')
                    or coalesce(ep.prematch_corner_line, '') <> coalesce((
                      select o.line
                      from event_odds o
                      where o.event_id = ep.event_id
                        and o.market = 'corner'
                        and o.type = 'pre-match'
                        and o.line is not null
                        and o.line <> ''
                      limit 1
                    ), '')
                  )
                )
            """;

    public static final String SQL_FILTER_NEEDS_FIRST_PREDICTION = """
              and exists (
                select 1
                from prediction_version pv
                where pv.is_active = 1
                  and pv.code in ('NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE')
                  and not exists (
                    select 1 from event_prediction ep
                    where ep.event_id = e.event_id
                      and ep.prediction_version_id = pv.prediction_version_id
                      and ep.status in ('completed', 'skipped')
                  )
              )
            """;

    public static final String SQL_FILTER_NEEDS_REPREDICT_ON_LINE_CHANGE = """
              and e.status_id = 1
              and exists (
                select 1
                from event_prediction ep
                       inner join prediction_version pv
                                  on pv.prediction_version_id = ep.prediction_version_id
                where ep.event_id = e.event_id
                  and ep.status = 'completed'
                  and pv.is_active = 1
                  and pv.code in ('NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE')
                  and (
            """ + SQL_LINES_CHANGED + """
                  )
              )
            """;

    public static final String SQL_FILTER_NEEDS_PREDICTION = """
            and (
              exists (
                select 1
                from prediction_version pv
                where pv.is_active = 1
                  and pv.code in ('NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE')
                  and not exists (
                    select 1 from event_prediction ep
                    where ep.event_id = e.event_id
                      and ep.prediction_version_id = pv.prediction_version_id
                      and ep.status in ('completed', 'skipped')
                  )
              )
              or (
                e.status_id = 1
                and exists (
                  select 1
                  from event_prediction ep
                         inner join prediction_version pv
                                    on pv.prediction_version_id = ep.prediction_version_id
                  where ep.event_id = e.event_id
                    and ep.status = 'completed'
                    and pv.is_active = 1
                    and pv.code in ('NO_PRICE', 'WITH_PRICE', 'WITH_LEAGUE_NO_PRICE')
                    and (
            """ + SQL_LINES_CHANGED + """
                    )
                  )
                )
              )
            """;

    public static final String SQL_FILTER_HAS_HDC_OU_LINES = """
              and exists (select 1 from event_odds o where o.event_id = e.event_id and o.market = 'hdc' and o.type = 'open' and o.line is not null and o.line <> '')
              and exists (select 1 from event_odds o where o.event_id = e.event_id and o.market = 'hdc' and o.type = 'pre-match' and o.line is not null and o.line <> '')
              and exists (select 1 from event_odds o where o.event_id = e.event_id and o.market = 'ou' and o.type = 'open' and o.line is not null and o.line <> '')
              and exists (select 1 from event_odds o where o.event_id = e.event_id and o.market = 'ou' and o.type = 'pre-match' and o.line is not null and o.line <> '')
            """;

    /**
     * @deprecated use {@link #SQL_FILTER_HAS_HDC_OU_LINES}
     */
    @Deprecated
    public static final String SQL_FILTER_HAS_ALL_ODDS_LINES = SQL_FILTER_HAS_HDC_OU_LINES;

    public record EnqueueBatchResult(int count, long lastEventId) {
    }

    public enum EnqueueMode {
        FIRST_PREDICTION,
        REPREDICT
    }

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ActivePredictionVersionCache versionCache;
    private final PredictProducer predictProducer;

    @Transactional
    public EnqueueBatchResult claimAndEnqueueFromQuery(String jobName, String selectSql, MapSqlParameterSource params) {
        List<Long> eventIds = jdbcTemplate.query(
                selectSql,
                params,
                (rs, rowNum) -> rs.getLong("event_id")
        );
        int count = claimAndEnqueue(jobName, eventIds, EnqueueMode.FIRST_PREDICTION);
        long lastEventId = eventIds.isEmpty()
                ? params.getValue("max_event_id") instanceof Number number ? number.longValue() : 0L
                : eventIds.getLast();
        return new EnqueueBatchResult(count, lastEventId);
    }

    @Transactional
    public int claimAndEnqueue(String jobName, List<Long> eventIds) {
        return claimAndEnqueue(jobName, eventIds, EnqueueMode.FIRST_PREDICTION);
    }

    @Transactional
    public int claimAndEnqueue(String jobName, List<Long> eventIds, EnqueueMode mode) {
        if (CollectionUtils.isEmpty(eventIds)) {
            return 0;
        }

        var activeVersions = versionCache.getActiveVersions();
        if (activeVersions.isEmpty()) {
            log.warning("Skip " + jobName + ": no active prediction versions");
            return 0;
        }

        var enqueuedEventIds = List.copyOf(eventIds);
        registerAfterCommitPublish(jobName, enqueuedEventIds);
        return enqueuedEventIds.size();
    }

    private void registerAfterCommitPublish(String jobName, List<Long> eventIds) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            publishAfterCommit(jobName, eventIds);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                publishAfterCommit(jobName, eventIds);
            }
        });
    }

    private void publishAfterCommit(String jobName, List<Long> eventIds) {
        int sent = 0;
        for (Long eventId : eventIds) {
            try {
                predictProducer.sendPredict(new PredictJobMessage(eventId, null));
                sent++;
            } catch (Exception ex) {
                log.log(Level.WARNING, jobName + ": failed to enqueue predict for event_id=" + eventId, ex);
            }
        }
        if (sent > 0) {
            log.info(jobName + ": enqueued predict for " + sent + " of " + eventIds.size() + " events");
        }
    }
}

package kira.producer.service;

import kira.producer.amqp.SettleProducer;
import kira.producer.dto.SettleJobMessage;
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
public class PredictionSettleEnqueueService {

    static final String SQL_SELECT_UNSETTLED_EVENTS = """
            select distinct ep.event_id
            from event_prediction ep
                     inner join event_result er on er.event_id = ep.event_id
                     inner join events e on e.event_id = ep.event_id
            where ep.status = 'completed'
              and ep.settled_at is null
              and er.ft_home_goal is not null
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
            order by ep.event_id
            limit :batch_limit
            for update skip locked
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final SettleProducer settleProducer;

    @Transactional
    public int enqueueBatch(String jobName, int batchLimit) {
        List<Long> eventIds = jdbcTemplate.query(
                SQL_SELECT_UNSETTLED_EVENTS,
                new MapSqlParameterSource("batch_limit", batchLimit),
                (rs, rowNum) -> rs.getLong("event_id")
        );
        if (CollectionUtils.isEmpty(eventIds)) {
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
                settleProducer.sendSettle(new SettleJobMessage(eventId));
                sent++;
            } catch (Exception ex) {
                log.log(Level.WARNING, jobName + ": failed to enqueue settle for event_id=" + eventId, ex);
            }
        }
        if (sent > 0) {
            log.info(jobName + ": enqueued settle for " + sent + " of " + eventIds.size() + " events");
        }
    }
}

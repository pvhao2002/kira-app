package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.dto.PredictJobMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Log
@Service
@RequiredArgsConstructor
public class BaseDataPredictionEngine {

    private static final String VERSION_CODE = PredictJobMessage.VERSION_BASE_DATA;

    private static final String SQL_TOP_SCORES = """
            select er.ft_goal_str,
                   count(*) as match_count
            from events e
                     inner join event_result er on er.event_id = e.event_id
                     inner join event_odds hist_open_hdc
                                on hist_open_hdc.event_id = e.event_id
                                    and hist_open_hdc.type = 'open'
                                    and hist_open_hdc.market = 'hdc'
                                    and hist_open_hdc.line = :open_hdc_line
                     inner join event_odds hist_pm_hdc
                                on hist_pm_hdc.event_id = e.event_id
                                    and hist_pm_hdc.type = 'pre-match'
                                    and hist_pm_hdc.market = 'hdc'
                                    and hist_pm_hdc.line = :prematch_hdc_line
                     inner join event_odds hist_open_ou
                                on hist_open_ou.event_id = e.event_id
                                    and hist_open_ou.type = 'open'
                                    and hist_open_ou.market = 'ou'
                                    and hist_open_ou.line = :open_ou_line
                     inner join event_odds hist_pm_ou
                                on hist_pm_ou.event_id = e.event_id
                                    and hist_pm_ou.type = 'pre-match'
                                    and hist_pm_ou.market = 'ou'
                                    and hist_pm_ou.line = :prematch_ou_line
            where e.event_id <> :event_id
              and er.ft_goal_str is not null
              and er.ft_goal_str <> ''
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
            group by er.ft_goal_str
            order by match_count desc, er.ft_goal_str asc
            limit 3
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final PredictionEngineSupport support;

    @Transactional
    public void predict(long eventId) {
        var versionId = support.loadVersionId(VERSION_CODE);
        if (versionId.isEmpty()) {
            log.warning("Prediction version not found: " + VERSION_CODE);
            return;
        }

        var odds = support.loadTargetOdds(eventId);
        if (odds == null) {
            support.persistSkipped(eventId, versionId.get(), "Event not found");
            return;
        }

        if (!PredictionEngineSupport.hasRequiredOpenPrematchLines(odds)) {
            support.persistSkipped(eventId, versionId.get(), "Missing required open or pre-match hdc/ou lines");
            return;
        }

        var topScores = findTopScores(eventId, odds);
        if (topScores.isEmpty()) {
            support.persistSkipped(eventId, versionId.get(), "No historical matches for open/pre-match line pattern");
            return;
        }

        support.persistCompleted(eventId, versionId.get(), odds, topScores);
        log.info(() -> "Base Data prediction completed for event_id=" + eventId + ", scores=" + topScores.size());
    }

    private List<ScoreMatchRow> findTopScores(long eventId, TargetEventOdds odds) {
        var params = new MapSqlParameterSource()
                .addValue("event_id", eventId)
                .addValue("open_hdc_line", odds.openHdcLine())
                .addValue("prematch_hdc_line", odds.prematchHdcLine())
                .addValue("open_ou_line", odds.openOuLine())
                .addValue("prematch_ou_line", odds.prematchOuLine());

        return jdbcTemplate.query(
                SQL_TOP_SCORES,
                params,
                (rs, rowNum) -> new ScoreMatchRow(rs.getString("ft_goal_str"), rs.getInt("match_count"))
        );
    }
}

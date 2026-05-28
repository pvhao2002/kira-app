package com.queue.kiraqueue.prediction;

import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Log
@Service
@RequiredArgsConstructor
public class PredictionSettleService {

    private static final String SQL_SELECT_UNSETTLED = """
            select ep.event_prediction_id,
                   ep.hdc_pick,
                   ep.ou_pick,
                   ep.prematch_hdc_line,
                   ep.prematch_ou_line,
                   er.ft_home_goal,
                   er.ft_away_goal,
                   er.ft_goal_str
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
            """;

    private static final String SQL_SELECT_UNSETTLED_BY_EVENT = SQL_SELECT_UNSETTLED + """
              and ep.event_id = :event_id
            """;

    private static final String SQL_UPDATE_OUTCOME = """
            update event_prediction
            set actual_ft_goal_str = :actual_ft_goal_str,
                result_hdc         = :result_hdc,
                result_ou          = :result_ou,
                settled_at         = current_timestamp
            where event_prediction_id = :event_prediction_id
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public int settlePending(int limit) {
        var rows = jdbcTemplate.query(
                SQL_SELECT_UNSETTLED + " limit :limit",
                Map.of("limit", limit),
                (rs, rowNum) -> new SettleRow(
                        rs.getLong("event_prediction_id"),
                        rs.getString("hdc_pick"),
                        rs.getString("ou_pick"),
                        rs.getString("prematch_hdc_line"),
                        rs.getString("prematch_ou_line"),
                        rs.getInt("ft_home_goal"),
                        rs.getInt("ft_away_goal"),
                        rs.getString("ft_goal_str")
                )
        );
        rows.forEach(this::settleRow);
        return rows.size();
    }

    @Transactional
    public void settleEvent(long eventId) {
        var rows = jdbcTemplate.query(
                SQL_SELECT_UNSETTLED_BY_EVENT,
                Map.of("event_id", eventId),
                (rs, rowNum) -> new SettleRow(
                        rs.getLong("event_prediction_id"),
                        rs.getString("hdc_pick"),
                        rs.getString("ou_pick"),
                        rs.getString("prematch_hdc_line"),
                        rs.getString("prematch_ou_line"),
                        rs.getInt("ft_home_goal"),
                        rs.getInt("ft_away_goal"),
                        rs.getString("ft_goal_str")
                )
        );
        rows.forEach(this::settleRow);
    }

    private void settleRow(SettleRow row) {
        var hdcPick = PredictionSettlement.parsePick(row.hdcPick());
        var ouPick = PredictionSettlement.parsePick(row.ouPick());

        var resultHdc = PredictionSettlement.settleHandicap(
                row.homeGoals(),
                row.awayGoals(),
                row.prematchHdcLine(),
                hdcPick
        );
        var resultOu = PredictionSettlement.settleOverUnder(
                row.homeGoals(),
                row.awayGoals(),
                row.prematchOuLine(),
                ouPick
        );

        jdbcTemplate.update(SQL_UPDATE_OUTCOME, new MapSqlParameterSource()
                .addValue("event_prediction_id", row.eventPredictionId())
                .addValue("actual_ft_goal_str", row.ftGoalStr())
                .addValue("result_hdc", resultHdc.name())
                .addValue("result_ou", resultOu.name()));
    }

    private record SettleRow(
            long eventPredictionId,
            String hdcPick,
            String ouPick,
            String prematchHdcLine,
            String prematchOuLine,
            int homeGoals,
            int awayGoals,
            String ftGoalStr
    ) {
    }
}

package com.app.kira.rest;

import com.app.kira.dto.prediction.EventPredictionDto;
import com.app.kira.dto.prediction.PredictionScoreDto;
import com.app.kira.dto.prediction.PredictionVersionDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping
public class PredictionController {

    private static final String SQL_VERSIONS = """
            select code, display_name, description, sort_order
            from prediction_version
            where is_active = 1
            order by sort_order, display_name
            """;

    private static final String SQL_PREDICTIONS = """
            select ep.event_prediction_id,
                   ep.event_id,
                   pv.code              as version_code,
                   pv.display_name      as version_display_name,
                   ep.status,
                   e.event_name,
                   e.event_date,
                   kl.league_name,
                   kl.is_main           as is_main_league,
                   e.link               as event_link,
                   th.logo_url          as home_logo,
                   ta.logo_url          as away_logo,
                   ep.prematch_hdc_line,
                   ep.prematch_ou_line,
                   ep.prematch_hdc_price_a,
                   ep.prematch_hdc_price_b,
                   ep.prematch_ou_price_a,
                   ep.prematch_ou_price_b,
                   ep.hdc_pick,
                   ep.ou_pick,
                   ep.hdc_vote_count,
                   ep.ou_vote_count,
                   ep.match_sample_count,
                   ep.error_message,
                   eps.rank_no,
                   eps.ft_goal_str,
                   eps.match_count      as score_match_count,
                   eps.hdc_pick         as score_hdc_pick,
                   eps.ou_pick          as score_ou_pick
            from event_prediction ep
                     inner join prediction_version pv on pv.prediction_version_id = ep.prediction_version_id
                     inner join events e on e.event_id = ep.event_id
                     left join kira_league kl on kl.league_id = e.league_id
                     left join teams th on th.team_id = e.home_id
                     left join teams ta on ta.team_id = e.away_id
                     left join event_prediction_score eps on eps.event_prediction_id = ep.event_prediction_id
            where pv.code = :version_code
              and ep.status = 'completed'
              and e.event_date >= coalesce(:from_date, convert_tz(now(), 'SYSTEM', '+07:00') - interval 1 hour)
              and e.event_date <= coalesce(:to_date, convert_tz(now(), 'SYSTEM', '+07:00') + interval 24 hour)
            order by kl.is_main desc, e.event_date, ep.event_prediction_id, eps.rank_no
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    @GetMapping("/prediction-versions")
    public List<PredictionVersionDto> listVersions() {
        return jdbcTemplate.query(SQL_VERSIONS, (rs, rowNum) -> {
            var dto = new PredictionVersionDto();
            dto.setCode(rs.getString("code"));
            dto.setDisplayName(rs.getString("display_name"));
            dto.setDescription(rs.getString("description"));
            dto.setSortOrder(rs.getInt("sort_order"));
            return dto;
        });
    }

    @GetMapping("/predictions")
    public List<EventPredictionDto> listPredictions(
            @RequestParam(defaultValue = "base_data") String version,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        if (!StringUtils.hasText(version)) {
            return Collections.emptyList();
        }
        var params = new MapSqlParameterSource()
                .addValue("version_code", version.trim())
                .addValue("from_date", from)
                .addValue("to_date", to);

        Map<Long, EventPredictionDto> byPredictionId = new LinkedHashMap<>();
        jdbcTemplate.query(SQL_PREDICTIONS, params, rs -> {
            long predictionId = rs.getLong("event_prediction_id");
            var dto = byPredictionId.computeIfAbsent(predictionId, id -> mapEvent(rs));
            if (rs.getObject("rank_no") != null) {
                dto.getTopScores().add(mapScore(rs));
            }
        });
        return List.copyOf(byPredictionId.values());
    }

    private static EventPredictionDto mapEvent(ResultSet rs) {
        try {
            var dto = new EventPredictionDto();
            dto.setEventPredictionId(rs.getLong("event_prediction_id"));
            dto.setEventId(rs.getLong("event_id"));
            dto.setVersionCode(rs.getString("version_code"));
            dto.setVersionDisplayName(rs.getString("version_display_name"));
            dto.setStatus(rs.getString("status"));
            dto.setEventName(rs.getString("event_name"));
            var eventDate = rs.getTimestamp("event_date");
            dto.setEventDate(eventDate != null ? eventDate.toInstant().toString() : null);
            dto.setLeagueName(rs.getString("league_name"));
            dto.setIsMainLeague(rs.getObject("is_main_league") != null && rs.getBoolean("is_main_league"));
            dto.setEventLink(rs.getString("event_link"));
            dto.setHomeLogo(rs.getString("home_logo"));
            dto.setAwayLogo(rs.getString("away_logo"));
            dto.setPrematchHdcLine(rs.getString("prematch_hdc_line"));
            dto.setPrematchOuLine(rs.getString("prematch_ou_line"));
            dto.setPrematchHdcPriceA(getDouble(rs, "prematch_hdc_price_a"));
            dto.setPrematchHdcPriceB(getDouble(rs, "prematch_hdc_price_b"));
            dto.setPrematchOuPriceA(getDouble(rs, "prematch_ou_price_a"));
            dto.setPrematchOuPriceB(getDouble(rs, "prematch_ou_price_b"));
            dto.setHdcPick(rs.getString("hdc_pick"));
            dto.setOuPick(rs.getString("ou_pick"));
            dto.setHdcVoteCount(getInteger(rs, "hdc_vote_count"));
            dto.setOuVoteCount(getInteger(rs, "ou_vote_count"));
            dto.setMatchSampleCount(getInteger(rs, "match_sample_count"));
            dto.setErrorMessage(rs.getString("error_message"));
            dto.setTopScores(new ArrayList<>());
            return dto;
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to map prediction row", ex);
        }
    }

    private static PredictionScoreDto mapScore(ResultSet rs) throws SQLException {
        var score = new PredictionScoreDto();
        score.setRankNo(rs.getInt("rank_no"));
        score.setFtGoalStr(rs.getString("ft_goal_str"));
        score.setMatchCount(rs.getInt("score_match_count"));
        score.setHdcPick(rs.getString("score_hdc_pick"));
        score.setOuPick(rs.getString("score_ou_pick"));
        return score;
    }

    private static Double getDouble(ResultSet rs, String column) throws SQLException {
        var value = rs.getObject(column);
        return value == null ? null : rs.getDouble(column);
    }

    private static Integer getInteger(ResultSet rs, String column) throws SQLException {
        var value = rs.getObject(column);
        return value == null ? null : rs.getInt(column);
    }
}

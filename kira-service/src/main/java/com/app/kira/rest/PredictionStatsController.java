package com.app.kira.rest;

import com.app.kira.dto.prediction.PredictionLeagueStatsDto;
import com.app.kira.dto.prediction.PredictionMarketStatsDto;
import com.app.kira.dto.prediction.PredictionStatsCompareDto;
import com.app.kira.dto.prediction.PredictionStatsSummaryDto;
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
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/prediction-stats")
public class PredictionStatsController {

    private static final String SQL_SUMMARY = """
            select pv.code as version_code,
                   pv.display_name as version_display_name,
                   sum(ep.status = 'completed') as total_completed,
                   sum(ep.settled_at is not null) as total_settled,
                   sum(ep.status = 'skipped') as total_skipped,
                   sum(ep.status = 'failed') as total_failed,
                   avg(ep.match_sample_count) as avg_match_sample_count,
                   sum(ep.result_hdc = 'WIN') as hdc_win,
                   sum(ep.result_hdc = 'LOSE') as hdc_lose,
                   sum(ep.result_hdc = 'VOID') as hdc_void,
                   sum(ep.result_hdc = 'NONE') as hdc_none,
                   sum(ep.result_ou = 'WIN') as ou_win,
                   sum(ep.result_ou = 'LOSE') as ou_lose,
                   sum(ep.result_ou = 'VOID') as ou_void,
                   sum(ep.result_ou = 'NONE') as ou_none
            from event_prediction ep
                     inner join prediction_version pv on pv.prediction_version_id = ep.prediction_version_id
                     inner join events e on e.event_id = ep.event_id
            where pv.code = :version_code
              and (:from_date is null or e.event_date >= :from_date)
              and (:to_date is null or e.event_date <= :to_date)
            """;

    private static final String SQL_BY_LEAGUE = """
            select kl.league_name,
                   coalesce(kl.is_main, 0) as is_main_league,
                   count(*) as settled_count,
                   sum(ep.result_hdc = 'WIN') as hdc_win,
                   sum(ep.result_hdc = 'LOSE') as hdc_lose,
                   sum(ep.result_hdc = 'VOID') as hdc_void,
                   sum(ep.result_hdc = 'NONE') as hdc_none,
                   sum(ep.result_ou = 'WIN') as ou_win,
                   sum(ep.result_ou = 'LOSE') as ou_lose,
                   sum(ep.result_ou = 'VOID') as ou_void,
                   sum(ep.result_ou = 'NONE') as ou_none
            from event_prediction ep
                     inner join prediction_version pv on pv.prediction_version_id = ep.prediction_version_id
                     inner join events e on e.event_id = ep.event_id
                     left join kira_league kl on kl.league_id = e.league_id
            where pv.code = :version_code
              and ep.settled_at is not null
              and (:from_date is null or e.event_date >= :from_date)
              and (:to_date is null or e.event_date <= :to_date)
            group by kl.league_name, kl.is_main
            order by settled_count desc, kl.league_name asc
            limit 20
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    @GetMapping("/summary")
    public PredictionStatsSummaryDto summary(
            @RequestParam(defaultValue = "base_data") String version,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        return loadSummary(version, from, to);
    }

    @GetMapping("/compare")
    public PredictionStatsCompareDto compare(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        var response = new PredictionStatsCompareDto();
        response.setFrom(from);
        response.setTo(to);
        response.setBaseData(loadSummary("base_data", from, to));
        response.setOddsMovement(loadSummary("odds_movement", from, to));
        return response;
    }

    private PredictionStatsSummaryDto loadSummary(String version, String from, String to) {
        var params = dateParams(version, from, to);
        var summaries = jdbcTemplate.query(SQL_SUMMARY, params, (rs, rowNum) -> mapSummary(rs, from, to));
        var summary = summaries.isEmpty() ? emptySummary(version, from, to) : summaries.getFirst();

        var leagues = jdbcTemplate.query(SQL_BY_LEAGUE, params, (rs, rowNum) -> {
            var dto = new PredictionLeagueStatsDto();
            dto.setLeagueName(rs.getString("league_name"));
            dto.setIsMainLeague(rs.getInt("is_main_league") == 1);
            dto.setSettledCount(rs.getInt("settled_count"));
            dto.setHdc(marketStats(rs, "hdc"));
            dto.setOu(marketStats(rs, "ou"));
            return dto;
        });
        summary.setByLeague(leagues);
        return summary;
    }

    private static PredictionStatsSummaryDto mapSummary(ResultSet rs, String from, String to) throws SQLException {
        var summary = new PredictionStatsSummaryDto();
        summary.setVersionCode(rs.getString("version_code"));
        summary.setVersionDisplayName(rs.getString("version_display_name"));
        summary.setFrom(from);
        summary.setTo(to);
        summary.setTotalCompleted(rs.getInt("total_completed"));
        summary.setTotalSettled(rs.getInt("total_settled"));
        summary.setTotalSkipped(rs.getInt("total_skipped"));
        summary.setTotalFailed(rs.getInt("total_failed"));
        var avg = rs.getObject("avg_match_sample_count");
        summary.setAvgMatchSampleCount(avg == null ? null : rs.getDouble("avg_match_sample_count"));
        summary.setHdc(marketStats(rs, "hdc"));
        summary.setOu(marketStats(rs, "ou"));
        summary.setByLeague(new ArrayList<>());
        return summary;
    }

    private static PredictionMarketStatsDto marketStats(ResultSet rs, String prefix) throws SQLException {
        int win = rs.getInt(prefix + "_win");
        int lose = rs.getInt(prefix + "_lose");
        int voidCount = rs.getInt(prefix + "_void");
        int none = rs.getInt(prefix + "_none");
        var dto = new PredictionMarketStatsDto();
        dto.setWinCount(win);
        dto.setLoseCount(lose);
        dto.setVoidCount(voidCount);
        dto.setNoneCount(none);
        int decisive = win + lose;
        dto.setAccuracyPct(decisive == 0 ? null : round2(100.0 * win / decisive));
        return dto;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static MapSqlParameterSource dateParams(String version, String from, String to) {
        return new MapSqlParameterSource()
                .addValue("version_code", version.trim())
                .addValue("from_date", StringUtils.hasText(from) ? from : null)
                .addValue("to_date", StringUtils.hasText(to) ? to : null);
    }

    private static PredictionStatsSummaryDto emptySummary(String version, String from, String to) {
        var summary = new PredictionStatsSummaryDto();
        summary.setVersionCode(version);
        summary.setVersionDisplayName(version);
        summary.setFrom(from);
        summary.setTo(to);
        summary.setHdc(new PredictionMarketStatsDto());
        summary.setOu(new PredictionMarketStatsDto());
        summary.setByLeague(List.of());
        return summary;
    }
}

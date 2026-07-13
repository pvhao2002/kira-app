package com.db.kiragateway.predictionstats;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class PredictionStatisticsRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public PredictionStatisticsRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PredictionVersionOption> findVersions() {
        var sql = """
                select prediction_version_id, code, display_name, is_active
                from prediction_version
                order by is_active desc, sort_order asc, prediction_version_id asc
                """;
        return jdbc.query(sql, this::mapVersion);
    }

    public Optional<PredictionVersionOption> findVersion(long predictionVersionId) {
        var sql = """
                select prediction_version_id, code, display_name, is_active
                from prediction_version
                where prediction_version_id = :version_id
                """;
        var rows = jdbc.query(sql,
                new MapSqlParameterSource("version_id", predictionVersionId),
                this::mapVersion);
        if (rows.isEmpty() || rows.get(0) == null) {
            return Optional.empty();
        }
        return Optional.of(rows.get(0));
    }

    public Optional<PredictionVersionOption> findDefaultVersion() {
        var versions = findVersions();
        return versions.stream().findFirst();
    }

    public Optional<LocalDateTime> latestSettledAt(long predictionVersionId, LocalDate from, LocalDate to) {
        var sql = """
                select max(settled_at) as latest_settled_at
                from event_prediction
                where prediction_version_id = :version_id
                  and status = 'completed'
                  and settled_at is not null
                  and (:from_at is null or settled_at >= :from_at)
                  and (:to_exclusive is null or settled_at < :to_exclusive)
                """;
        var rows = jdbc.query(sql, baseParams(predictionVersionId, from, to), (rs, rn) -> {
            var ts = rs.getTimestamp("latest_settled_at");
            return ts != null ? ts.toLocalDateTime() : null;
        });
        return rows.stream().findFirst();
    }

    public PredictionStatsSummary summary(long predictionVersionId, LocalDate from, LocalDate to) {
        var sql = """
                select
                    count(*) as prediction_count,
                    sum(case when result_hdc in ('WIN', 'LOSE', 'VOID') then 1 else 0 end)
                      + sum(case when result_ou in ('WIN', 'LOSE', 'VOID') then 1 else 0 end) as settled_market_count,
                    sum(case when result_hdc = 'WIN' then 1 else 0 end)
                      + sum(case when result_ou = 'WIN' then 1 else 0 end) as total_wins,
                    sum(case when result_hdc = 'LOSE' then 1 else 0 end)
                      + sum(case when result_ou = 'LOSE' then 1 else 0 end) as total_losses,
                    sum(case when result_hdc = 'VOID' then 1 else 0 end)
                      + sum(case when result_ou = 'VOID' then 1 else 0 end) as total_voids,
                    sum(case when result_hdc = 'WIN' then 1 else 0 end) as hdc_wins,
                    sum(case when result_hdc = 'LOSE' then 1 else 0 end) as hdc_losses,
                    sum(case when result_hdc = 'VOID' then 1 else 0 end) as hdc_voids,
                    sum(case when result_ou = 'WIN' then 1 else 0 end) as ou_wins,
                    sum(case when result_ou = 'LOSE' then 1 else 0 end) as ou_losses,
                    sum(case when result_ou = 'VOID' then 1 else 0 end) as ou_voids,
                    sum(case when result_hdc = 'WIN' and result_ou = 'WIN' then 1 else 0 end) as both_win_count
                from event_prediction
                where prediction_version_id = :version_id
                  and status = 'completed'
                  and settled_at is not null
                  and (:from_at is null or settled_at >= :from_at)
                  and (:to_exclusive is null or settled_at < :to_exclusive)
                """;
        var rows = jdbc.query(sql, baseParams(predictionVersionId, from, to), this::mapSummary);
        return rows.isEmpty() ? emptySummary() : rows.get(0);
    }

    public List<PredictionPeriodStats> periodStats(long predictionVersionId,
                                                   LocalDate from,
                                                   LocalDate to,
                                                   PeriodType periodType) {
        var periodExpression = switch (periodType) {
            case DAY -> "date(settled_at)";
            case WEEK -> "date_sub(date(settled_at), interval weekday(settled_at) day)";
            case MONTH -> "date_sub(date(settled_at), interval (dayofmonth(settled_at) - 1) day)";
        };
        var sql = """
                select
                    %s as period_start,
                    count(*) as prediction_count,
                    sum(case when result_hdc = 'WIN' then 1 else 0 end)
                      + sum(case when result_ou = 'WIN' then 1 else 0 end) as total_wins,
                    sum(case when result_hdc = 'LOSE' then 1 else 0 end)
                      + sum(case when result_ou = 'LOSE' then 1 else 0 end) as total_losses,
                    sum(case when result_hdc = 'VOID' then 1 else 0 end)
                      + sum(case when result_ou = 'VOID' then 1 else 0 end) as total_voids,
                    sum(case when result_hdc = 'WIN' then 1 else 0 end) as hdc_wins,
                    sum(case when result_hdc = 'LOSE' then 1 else 0 end) as hdc_losses,
                    sum(case when result_ou = 'WIN' then 1 else 0 end) as ou_wins,
                    sum(case when result_ou = 'LOSE' then 1 else 0 end) as ou_losses,
                    sum(case when result_hdc = 'WIN' and result_ou = 'WIN' then 1 else 0 end) as both_win_count
                from event_prediction
                where prediction_version_id = :version_id
                  and status = 'completed'
                  and settled_at is not null
                  and (:from_at is null or settled_at >= :from_at)
                  and (:to_exclusive is null or settled_at < :to_exclusive)
                group by period_start
                order by period_start asc
                """.formatted(periodExpression);
        return jdbc.query(sql, baseParams(predictionVersionId, from, to),
                (rs, rn) -> mapPeriod(rs, periodType));
    }

    public List<PredictionLinePairStats> linePairStats(long predictionVersionId,
                                                       LocalDate from,
                                                       LocalDate to,
                                                       int limit) {
        var sql = """
                select
                    coalesce(nullif(prematch_hdc_line, ''), 'N/A') as prematch_hdc_line,
                    coalesce(nullif(prematch_ou_line, ''), 'N/A') as prematch_ou_line,
                    coalesce(nullif(open_hdc_line, ''), 'N/A') as open_hdc_line,
                    coalesce(nullif(open_ou_line, ''), 'N/A') as open_ou_line,
                    sum(case when result_hdc = 'WIN' and result_ou = 'WIN' then 1 else 0 end) as both_win_count,
                    count(*) as both_settled_count,
                    sum(case when hdc_pick = 'HOME' then 1 else 0 end) as hdc_home_pick_count,
                    sum(case when hdc_pick = 'AWAY' then 1 else 0 end) as hdc_away_pick_count,
                    sum(case when ou_pick = 'OVER' then 1 else 0 end) as ou_over_pick_count,
                    sum(case when ou_pick = 'UNDER' then 1 else 0 end) as ou_under_pick_count
                from event_prediction
                where prediction_version_id = :version_id
                  and status = 'completed'
                  and settled_at is not null
                  and result_hdc in ('WIN', 'LOSE')
                  and result_ou in ('WIN', 'LOSE')
                  and (:from_at is null or settled_at >= :from_at)
                  and (:to_exclusive is null or settled_at < :to_exclusive)
                group by prematch_hdc_line, prematch_ou_line, open_hdc_line, open_ou_line
                having both_win_count > 0
                order by both_win_count desc, both_win_count / nullif(both_settled_count, 0) desc, both_settled_count desc
                limit :limit
                """;
        return jdbc.query(sql,
                baseParams(predictionVersionId, from, to).addValue("limit", limit),
                this::mapLinePair);
    }

    private MapSqlParameterSource baseParams(long predictionVersionId, LocalDate from, LocalDate to) {
        return new MapSqlParameterSource()
                .addValue("version_id", predictionVersionId)
                .addValue("from_at", from != null ? Timestamp.valueOf(from.atStartOfDay()) : null)
                .addValue("to_exclusive", to != null ? Timestamp.valueOf(to.plusDays(1).atStartOfDay()) : null);
    }

    private PredictionVersionOption mapVersion(ResultSet rs, int rowNum) throws SQLException {
        return new PredictionVersionOption(
                rs.getLong("prediction_version_id"),
                rs.getString("code"),
                rs.getString("display_name"),
                rs.getBoolean("is_active")
        );
    }

    private PredictionStatsSummary mapSummary(ResultSet rs, int rowNum) throws SQLException {
        long predictionCount = rs.getLong("prediction_count");
        long settledMarketCount = rs.getLong("settled_market_count");
        long totalWins = rs.getLong("total_wins");
        long totalLosses = rs.getLong("total_losses");
        long totalVoids = rs.getLong("total_voids");
        long hdcWins = rs.getLong("hdc_wins");
        long hdcLosses = rs.getLong("hdc_losses");
        long hdcVoids = rs.getLong("hdc_voids");
        long ouWins = rs.getLong("ou_wins");
        long ouLosses = rs.getLong("ou_losses");
        long ouVoids = rs.getLong("ou_voids");
        long bothWinCount = rs.getLong("both_win_count");
        return new PredictionStatsSummary(
                predictionCount,
                settledMarketCount,
                totalWins,
                totalLosses,
                totalVoids,
                winRate(totalWins, totalLosses),
                hdcWins,
                hdcLosses,
                hdcVoids,
                winRate(hdcWins, hdcLosses),
                ouWins,
                ouLosses,
                ouVoids,
                winRate(ouWins, ouLosses),
                bothWinCount,
                ratio(bothWinCount, predictionCount)
        );
    }

    private PredictionPeriodStats mapPeriod(ResultSet rs, PeriodType periodType) throws SQLException {
        var periodDate = rs.getDate("period_start");
        var periodStart = periodDate != null ? periodDate.toLocalDate() : null;
        long predictionCount = rs.getLong("prediction_count");
        long totalWins = rs.getLong("total_wins");
        long totalLosses = rs.getLong("total_losses");
        long totalVoids = rs.getLong("total_voids");
        long hdcWins = rs.getLong("hdc_wins");
        long hdcLosses = rs.getLong("hdc_losses");
        long ouWins = rs.getLong("ou_wins");
        long ouLosses = rs.getLong("ou_losses");
        long bothWinCount = rs.getLong("both_win_count");
        return new PredictionPeriodStats(
                periodStart,
                label(periodStart, periodType),
                predictionCount,
                totalWins,
                totalLosses,
                totalVoids,
                winRate(totalWins, totalLosses),
                hdcWins,
                hdcLosses,
                winRate(hdcWins, hdcLosses),
                ouWins,
                ouLosses,
                winRate(ouWins, ouLosses),
                bothWinCount,
                ratio(bothWinCount, predictionCount)
        );
    }

    private PredictionLinePairStats mapLinePair(ResultSet rs, int rowNum) throws SQLException {
        long bothWinCount = rs.getLong("both_win_count");
        long bothSettledCount = rs.getLong("both_settled_count");
        return new PredictionLinePairStats(
                rs.getString("prematch_hdc_line"),
                rs.getString("prematch_ou_line"),
                rs.getString("open_hdc_line"),
                rs.getString("open_ou_line"),
                bothWinCount,
                bothSettledCount,
                ratio(bothWinCount, bothSettledCount),
                rs.getLong("hdc_home_pick_count"),
                rs.getLong("hdc_away_pick_count"),
                rs.getLong("ou_over_pick_count"),
                rs.getLong("ou_under_pick_count")
        );
    }

    private static PredictionStatsSummary emptySummary() {
        return new PredictionStatsSummary(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }

    private static double winRate(long wins, long losses) {
        return ratio(wins, wins + losses);
    }

    private static double ratio(long numerator, long denominator) {
        if (denominator <= 0) {
            return 0;
        }
        return Math.round((numerator * 10000.0 / denominator)) / 100.0;
    }

    private static String label(LocalDate periodStart, PeriodType periodType) {
        if (periodStart == null) {
            return "";
        }
        return switch (periodType) {
            case DAY -> periodStart.toString();
            case WEEK -> periodStart + " week";
            case MONTH -> periodStart.getYear() + "-" + String.format("%02d", periodStart.getMonthValue());
        };
    }

    public enum PeriodType {
        DAY,
        WEEK,
        MONTH
    }
}

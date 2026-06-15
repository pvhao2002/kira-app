package com.db.kiragateway.dashboard;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Repository
public class DashboardRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public DashboardRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Long> findActivePredictionVersionId() {
        var sql = """
                select prediction_version_id
                from prediction_version
                where is_active = 1
                order by sort_order, prediction_version_id
                limit 1
                """;
        var ids = jdbc.query(sql, (rs, rn) -> rs.getLong("prediction_version_id"));
        return ids.isEmpty() ? Optional.empty() : Optional.of(ids.get(0));
    }

    public SoccerStatsAgg findSoccerStats(long predictionVersionId, LocalDateTime weekStart) {
        var sql = """
                select
                    count(*) as tracked_count,
                    sum(case when settled_at >= :week_start then 1 else 0 end) as tracked_week,
                    sum(case when primary_result = 'WIN' then 1 else 0 end) as wins,
                    sum(case when primary_result = 'LOSE' then 1 else 0 end) as losses
                from (
                    select
                        ep.settled_at,
                        case
                            when ep.hdc_pick is not null and ep.hdc_pick <> 'NONE' then ep.result_hdc
                            else ep.result_ou
                        end as primary_result
                    from event_prediction ep
                    where ep.prediction_version_id = :version_id
                      and ep.status = 'completed'
                      and ep.settled_at is not null
                ) stats
                where primary_result in ('WIN', 'LOSE')
                """;
        var params = new MapSqlParameterSource()
                .addValue("version_id", predictionVersionId)
                .addValue("week_start", Timestamp.valueOf(weekStart));
        var list = jdbc.query(sql, params, (rs, rn) -> new SoccerStatsAgg(
                rs.getLong("tracked_count"),
                rs.getLong("tracked_week"),
                rs.getLong("wins"),
                rs.getLong("losses")
        ));
        if (list.isEmpty()) {
            return new SoccerStatsAgg(0, 0, 0, 0);
        }
        return list.get(0);
    }

    public long countSettledPredictions(long predictionVersionId) {
        var sql = """
                select count(*)
                from event_prediction
                where prediction_version_id = :version_id
                  and status = 'completed'
                  and settled_at is not null
                """;
        Long n = jdbc.queryForObject(sql,
                new MapSqlParameterSource("version_id", predictionVersionId),
                Long.class);
        return n != null ? n : 0L;
    }

    public BigDecimal netProfit(int userId) {
        var sql = """
                select coalesce(sum(
                    case
                        when type = 'deposit' then amount
                        when type = 'withdraw' then -amount
                        else 0
                    end
                ), 0) as net_profit
                from transactions
                where user_id = :user_id
                  and status = 'success'
                """;
        BigDecimal v = jdbc.queryForObject(sql,
                new MapSqlParameterSource("user_id", userId),
                BigDecimal.class);
        return v != null ? v : BigDecimal.ZERO;
    }

    public List<ProfitDayRow> profitByDay(int userId, LocalDateTime since) {
        var sql = """
                select date(transaction_at) as day,
                       coalesce(sum(
                           case
                               when type = 'deposit' then amount
                               when type = 'withdraw' then -amount
                               else 0
                           end
                       ), 0) as net_amount
                from transactions
                where user_id = :user_id
                  and status = 'success'
                  and transaction_at >= :since
                group by date(transaction_at)
                order by day asc
                """;
        return jdbc.query(sql,
                new MapSqlParameterSource("user_id", userId)
                        .addValue("since", Timestamp.valueOf(since)),
                this::mapProfitDay);
    }

    public List<TransactionActivityRow> recentTransactions(int userId, int limit) {
        var sql = """
                select type, amount, transaction_at, description
                from transactions
                where user_id = :user_id
                  and status = 'success'
                order by transaction_at desc, transaction_id desc
                limit :limit
                """;
        return jdbc.query(sql,
                new MapSqlParameterSource("user_id", userId).addValue("limit", limit),
                this::mapTransactionActivity);
    }

    public List<PredictionActivityRow> recentPredictions(long predictionVersionId, int limit) {
        var sql = """
                select e.event_name,
                       ht.team_name as home_team,
                       at2.team_name as away_team,
                       ep.hdc_pick,
                       ep.ou_pick,
                       ep.result_hdc,
                       ep.result_ou,
                       ep.prematch_hdc_price_a,
                       ep.prematch_ou_price_a,
                       ep.settled_at
                from event_prediction ep
                join events e on e.event_id = ep.event_id
                left join teams ht on ht.team_id = e.home_id
                left join teams at2 on at2.team_id = e.away_id
                where ep.prediction_version_id = :version_id
                  and ep.status = 'completed'
                  and ep.settled_at is not null
                order by ep.settled_at desc, ep.event_prediction_id desc
                limit :limit
                """;
        return jdbc.query(sql,
                new MapSqlParameterSource("version_id", predictionVersionId).addValue("limit", limit),
                this::mapPredictionActivity);
    }

    public List<CardPaymentActivityRow> recentCardPayments(int userId, int limit) {
        var sql = """
                select p.amount, p.note, p.paid_at, p.created_at,
                       c.card_label, c.last_four
                from credit_card_payments p
                join credit_cards c on c.credit_card_id = p.credit_card_id
                where p.user_id = :user_id
                order by p.paid_at desc, p.payment_id desc
                limit :limit
                """;
        return jdbc.query(sql,
                new MapSqlParameterSource("user_id", userId).addValue("limit", limit),
                this::mapCardPaymentActivity);
    }

    public static LocalDateTime startOfWeek(LocalDate today) {
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return monday.atStartOfDay();
    }

    public static String dayLabel(LocalDate date) {
        return date.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
    }

    private ProfitDayRow mapProfitDay(ResultSet rs, int rowNum) throws SQLException {
        var day = rs.getDate("day");
        return new ProfitDayRow(
                day != null ? day.toLocalDate() : null,
                rs.getBigDecimal("net_amount")
        );
    }

    private TransactionActivityRow mapTransactionActivity(ResultSet rs, int rowNum) throws SQLException {
        var at = rs.getTimestamp("transaction_at");
        return new TransactionActivityRow(
                rs.getString("type"),
                rs.getBigDecimal("amount"),
                at != null ? at.toLocalDateTime() : null,
                rs.getString("description")
        );
    }

    private PredictionActivityRow mapPredictionActivity(ResultSet rs, int rowNum) throws SQLException {
        var settled = rs.getTimestamp("settled_at");
        return new PredictionActivityRow(
                rs.getString("event_name"),
                rs.getString("home_team"),
                rs.getString("away_team"),
                rs.getString("hdc_pick"),
                rs.getString("ou_pick"),
                rs.getString("result_hdc"),
                rs.getString("result_ou"),
                rs.getBigDecimal("prematch_hdc_price_a"),
                rs.getBigDecimal("prematch_ou_price_a"),
                settled != null ? settled.toLocalDateTime() : null
        );
    }

    private CardPaymentActivityRow mapCardPaymentActivity(ResultSet rs, int rowNum) throws SQLException {
        var paid = rs.getDate("paid_at");
        var created = rs.getTimestamp("created_at");
        return new CardPaymentActivityRow(
                rs.getBigDecimal("amount"),
                rs.getString("note"),
                paid != null ? paid.toLocalDate().atStartOfDay() : null,
                created != null ? created.toLocalDateTime() : null,
                rs.getString("card_label"),
                rs.getString("last_four")
        );
    }

    public record SoccerStatsAgg(long trackedCount, long trackedThisWeek, long wins, long losses) {
    }

    public record ProfitDayRow(LocalDate day, BigDecimal netAmount) {
    }

    public record TransactionActivityRow(
            String type,
            BigDecimal amount,
            LocalDateTime transactionAt,
            String description
    ) {
    }

    public record PredictionActivityRow(
            String eventName,
            String homeTeam,
            String awayTeam,
            String hdcPick,
            String ouPick,
            String resultHdc,
            String resultOu,
            BigDecimal prematchHdcPriceA,
            BigDecimal prematchOuPriceA,
            LocalDateTime settledAt
    ) {
    }

    public record CardPaymentActivityRow(
            BigDecimal amount,
            String note,
            LocalDateTime paidAt,
            LocalDateTime createdAt,
            String cardLabel,
            String lastFour
    ) {
    }
}

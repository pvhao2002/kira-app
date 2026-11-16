package com.kira.affiliate.report.application;

import com.kira.affiliate.order.application.OrderQueryService;
import com.kira.affiliate.shared.web.ApiException;
import com.kira.affiliate.shared.web.DateRange;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {
    private static final String B = OrderQueryService.BUCKET;
    private static final String RANGE = OrderQueryService.FROM
        + " WHERE i.user_id = :userId AND i.purchase_time >= :from AND i.purchase_time < :to";
    // Vietnam has a fixed +07:00 offset (no DST), so a literal offset is exact and needs no MySQL tz tables.
    private static final String VN_DAY = "DATE(CONVERT_TZ(i.purchase_time, '+00:00', '+07:00'))";
    private static final Map<String, String> PERIODS = Map.of(
        "day", VN_DAY,
        "week", "DATE_SUB(" + VN_DAY + ", INTERVAL WEEKDAY(" + VN_DAY + ") DAY)",
        "month", "DATE_SUB(" + VN_DAY + ", INTERVAL DAYOFMONTH(" + VN_DAY + ") - 1 DAY)");

    private record Dimension(String key, String label, String join) {
    }

    private static final Map<String, Dimension> DIMENSIONS = Map.of(
        "product", new Dimension("i.item_id", "MAX(i.item_name)", ""),
        "shop", new Dimension("COALESCE(i.shop_id, '')", "MAX(i.shop_name)", ""),
        "subId", new Dimension("c.utm_content", "MAX(c.utm_content)", ""),
        "campaign", new Dimension("cp.id", "MAX(cp.name)",
            " JOIN campaigns cp ON cp.user_id = i.user_id AND cp.utm_key = c.utm_content"),
        "status", new Dimension("i.order_status", "MAX(i.order_status)", ""),
        "category", new Dimension("COALESCE(i.category_lv1, '')", "MAX(COALESCE(i.category_lv1, ''))", ""),
        "device", new Dimension("COALESCE(c.device, '')", "MAX(COALESCE(c.device, ''))", ""),
        "buyerType", new Dimension("COALESCE(c.buyer_type, '')", "MAX(COALESCE(c.buyer_type, ''))", ""));

    private final JdbcClient jdbc;

    public record Commission(BigDecimal estimated, BigDecimal confirmed, BigDecimal rejected, BigDecimal validated) {
    }

    /** clicksAvailable is always false: the Shopee Open API exposes no click counts. */
    public record Summary(long orders, long items, BigDecimal gmv, Commission commission, long links,
                          boolean clicksAvailable) {
    }

    public record Point(String period, long orders, BigDecimal gmv, BigDecimal estimated, BigDecimal confirmed,
                        BigDecimal rejected) {
    }

    public record TopRow(String key, String label, long orders, long items, BigDecimal gmv, BigDecimal commission) {
    }

    public Summary summary(Long userId, DateRange range) {
        long links = jdbc.sql("""
                SELECT COUNT(*) FROM affiliate_links
                WHERE user_id = :userId AND status = 'OK' AND created_at >= :from AND created_at < :to""")
            .param("userId", userId).param("from", DateRange.utc(range.from())).param("to", DateRange.utc(range.toExclusive()))
            .query(Long.class).single();
        return jdbc.sql("SELECT COUNT(DISTINCT i.order_id) AS orders, COALESCE(SUM(i.qty), 0) AS items, "
                + "COALESCE(SUM(CASE WHEN " + B + " <> 'REJECTED' THEN i.actual_amount ELSE 0 END), 0) AS gmv, "
                + sum("ESTIMATED") + " AS estimated, " + sum("CONFIRMED") + " AS confirmed, "
                + sum("REJECTED") + " AS rejected, " + sum("VALIDATED") + " AS validated" + RANGE)
            .param("userId", userId).param("from", DateRange.utc(range.from())).param("to", DateRange.utc(range.toExclusive()))
            .query((rs, n) -> new Summary(rs.getLong("orders"), rs.getLong("items"), rs.getBigDecimal("gmv"),
                new Commission(rs.getBigDecimal("estimated"), rs.getBigDecimal("confirmed"),
                    rs.getBigDecimal("rejected"), rs.getBigDecimal("validated")), links, false)).single();
    }

    /** In the series, "confirmed" includes validated commission (validated is a later stage of confirmed). */
    public List<Point> timeseries(Long userId, DateRange range, String granularity) {
        String period = PERIODS.get(granularity);
        if (period == null) throw invalid("granularity");
        return jdbc.sql("SELECT DATE_FORMAT(" + period + ", '%Y-%m-%d') AS period, COUNT(DISTINCT i.order_id) AS orders, "
                + "COALESCE(SUM(CASE WHEN " + B + " <> 'REJECTED' THEN i.actual_amount ELSE 0 END), 0) AS gmv, "
                + sum("ESTIMATED") + " AS estimated, "
                + "COALESCE(SUM(CASE WHEN " + B + " IN ('CONFIRMED','VALIDATED') THEN i.item_total_commission ELSE 0 END), 0) AS confirmed, "
                + sum("REJECTED") + " AS rejected" + RANGE + " GROUP BY period ORDER BY period")
            .param("userId", userId).param("from", DateRange.utc(range.from())).param("to", DateRange.utc(range.toExclusive()))
            .query((rs, n) -> new Point(rs.getString("period"), rs.getLong("orders"), rs.getBigDecimal("gmv"),
                rs.getBigDecimal("estimated"), rs.getBigDecimal("confirmed"), rs.getBigDecimal("rejected"))).list();
    }

    public List<TopRow> top(Long userId, DateRange range, String by, int limit) {
        Dimension d = DIMENSIONS.get(by);
        if (d == null) throw invalid("by");
        String from = OrderQueryService.FROM + d.join()
            + " WHERE i.user_id = :userId AND i.purchase_time >= :from AND i.purchase_time < :to";
        return jdbc.sql("SELECT " + d.key() + " AS k, " + d.label() + " AS label, COUNT(DISTINCT i.order_id) AS orders, "
                + "COALESCE(SUM(i.qty), 0) AS items, COALESCE(SUM(i.actual_amount), 0) AS gmv, "
                + "COALESCE(SUM(i.item_total_commission), 0) AS commission" + from
                + " GROUP BY k ORDER BY commission DESC, orders DESC LIMIT :limit")
            .param("userId", userId).param("from", DateRange.utc(range.from())).param("to", DateRange.utc(range.toExclusive()))
            .param("limit", Math.min(Math.max(limit, 1), 100))
            .query((rs, n) -> new TopRow(rs.getString("k"), rs.getString("label"), rs.getLong("orders"),
                rs.getLong("items"), rs.getBigDecimal("gmv"), rs.getBigDecimal("commission"))).list();
    }

    private static String sum(String bucket) {
        return "COALESCE(SUM(CASE WHEN " + B + " = '" + bucket + "' THEN i.item_total_commission ELSE 0 END), 0)";
    }

    private static ApiException invalid(String param) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "Tham số " + param + " không hợp lệ");
    }
}

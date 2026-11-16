package com.kira.affiliate.order.application;

import com.kira.affiliate.shared.web.ApiException;
import com.kira.affiliate.shared.web.ApiTypes.PageResponse;
import com.kira.affiliate.shared.web.Csv;
import com.kira.affiliate.shared.web.DateRange;
import com.kira.affiliate.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderQueryService {
    /**
     * The one definition of the commission buckets (also used by reports). Shopee has no "paid" status, so
     * VALIDATED means "present in an imported Shopee validated report".
     */
    public static final String BUCKET = """
        CASE WHEN i.order_status = 'CANCELLED' OR i.fraud_status = 'FRAUD' THEN 'REJECTED'
             WHEN c.validation_id IS NOT NULL THEN 'VALIDATED'
             WHEN i.order_status = 'COMPLETED' THEN 'CONFIRMED'
             ELSE 'ESTIMATED' END""";
    // Leading space matters: this is appended straight after a select list.
    public static final String FROM = " FROM conversion_items i"
        + " JOIN conversions c ON c.user_id = i.user_id AND c.conversion_id = i.conversion_id";
    private static final Map<String, String> SORTS = Map.of("purchaseTime", "i.purchase_time",
        "commission", "i.item_total_commission", "actualAmount", "i.actual_amount");
    private static final DateTimeFormatter VN_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(DateRange.VN);
    private static final String SELECT = "SELECT i.*, c.click_time, c.utm_content, c.buyer_type, c.device, c.referrer, "
        + "c.total_commission, c.net_commission, c.validation_id, c.validated_at, " + BUCKET + " AS bucket" + FROM;

    private final JdbcClient jdbc;

    public record Filter(String search, String orderStatus, String bucket, LocalDate from, LocalDate to) {
    }

    public record OrderRow(long id, String conversionId, String orderId, String itemId, String itemName, String shopName,
                           String imageUrl, int qty, BigDecimal itemPrice, BigDecimal actualAmount,
                           BigDecimal refundAmount, String orderStatus, String fraudStatus, String bucket,
                           BigDecimal commission, Instant purchaseTime, Instant completeTime, String utmContent) {
    }

    public record OrderDetail(long id, String conversionId, String orderId, String itemId, String itemName,
                              String shopName, String imageUrl, int qty, BigDecimal itemPrice, BigDecimal actualAmount,
                              BigDecimal refundAmount, String orderStatus, String fraudStatus, String bucket,
                              BigDecimal commission, Instant purchaseTime, Instant completeTime, String utmContent,
                              String modelId, Instant clickTime, String buyerType, String device, String referrer,
                              BigDecimal itemSellerCommission, BigDecimal itemShopeeCommission,
                              BigDecimal conversionTotalCommission, BigDecimal conversionNetCommission,
                              Instant validatedAt, Long validationId, String categoryLv1, String itemNotes) {
    }

    public record ValidationView(long validationId, Instant importedAt, long conversions, BigDecimal totalCommission) {
    }

    public PageResponse<OrderRow> list(Long userId, Filter filter, int page, int size, String sort) {
        int p = Paging.page(page), s = Paging.size(size);
        String[] parts = sort.split(",");
        String column = SORTS.get(parts[0]);
        if (column == null) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT", "Tiêu chí sắp xếp không hợp lệ");
        String direction = parts.length > 1 && parts[1].equalsIgnoreCase("asc") ? "ASC" : "DESC";
        Map<String, Object> params = new HashMap<>();
        String where = where(userId, filter, params);
        long total = jdbc.sql("SELECT COUNT(*)" + FROM + where).params(params).query(Long.class).single();
        params.put("limit", s);
        params.put("offset", (long) p * s);
        List<OrderRow> data = jdbc.sql(SELECT + where + " ORDER BY " + column + " " + direction + ", i.id " + direction
            + " LIMIT :limit OFFSET :offset").params(params).query(OrderQueryService::row).list();
        return Paging.response(data, p, s, total);
    }

    public OrderDetail detail(Long userId, long id) {
        return jdbc.sql(SELECT + " WHERE i.user_id = :userId AND i.id = :id").param("userId", userId).param("id", id)
            .query(OrderQueryService::detail).optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng"));
    }

    // shortcut: export is built in memory and capped at 50k rows; stream it if users outgrow the cap.
    public Csv export(Long userId, Filter filter) {
        Map<String, Object> params = new HashMap<>();
        String where = where(userId, filter, params);
        Csv csv = new Csv().row("Thời gian mua", "Mã đơn", "Mã chuyển đổi", "Sản phẩm", "Shop", "Số lượng", "Giá trị (VND)",
            "Hoa hồng (VND)", "Trạng thái đơn", "Nhóm hoa hồng", "Sub ID", "Hoàn tất");
        jdbc.sql(SELECT + where + " ORDER BY i.purchase_time DESC, i.id DESC LIMIT 50000").params(params)
            .query(OrderQueryService::row).list().forEach(o -> csv.row(VN_TIME.format(o.purchaseTime()), o.orderId(),
                o.conversionId(), o.itemName(), o.shopName(), o.qty(), o.actualAmount(), o.commission(),
                o.orderStatus(), bucketLabel(o.bucket()), o.utmContent(),
                o.completeTime() == null ? "" : VN_TIME.format(o.completeTime())));
        return csv;
    }

    public List<ValidationView> validations(Long userId) {
        return jdbc.sql("""
                SELECT v.validation_id, v.imported_at, COUNT(c.id) AS conversions,
                       COALESCE(SUM(c.net_commission), 0) AS total_commission
                FROM validations v
                LEFT JOIN conversions c ON c.user_id = v.user_id AND c.validation_id = v.validation_id
                WHERE v.user_id = :userId GROUP BY v.validation_id, v.imported_at ORDER BY v.imported_at DESC""")
            .param("userId", userId).query((rs, n) -> new ValidationView(rs.getLong("validation_id"),
                DateRange.instant(rs.getObject("imported_at", LocalDateTime.class)), rs.getLong("conversions"),
                rs.getBigDecimal("total_commission"))).list();
    }

    static String bucketLabel(String bucket) {
        return switch (bucket) {
            case "ESTIMATED" -> "Ước tính";
            case "CONFIRMED" -> "Đã xác nhận";
            case "REJECTED" -> "Bị hủy";
            case "VALIDATED" -> "Đã đối soát thanh toán";
            default -> bucket;
        };
    }

    private static String where(Long userId, Filter f, Map<String, Object> params) {
        StringBuilder where = new StringBuilder(" WHERE i.user_id = :userId");
        params.put("userId", userId);
        if (f.search() != null && !f.search().isBlank()) {
            where.append(" AND (i.item_name LIKE :search OR i.shop_name LIKE :search OR i.order_id LIKE :search"
                + " OR i.conversion_id LIKE :search OR c.utm_content LIKE :search)");
            params.put("search", Paging.contains(f.search()));
        }
        if (f.orderStatus() != null && !f.orderStatus().isBlank()) {
            where.append(" AND i.order_status = :orderStatus");
            params.put("orderStatus", f.orderStatus());
        }
        if (f.bucket() != null && !f.bucket().isBlank()) {
            where.append(" AND ").append(BUCKET).append(" = :bucket");
            params.put("bucket", f.bucket());
        }
        if (f.from() != null) {
            where.append(" AND i.purchase_time >= :from");
            params.put("from", DateRange.utc(DateRange.startOf(f.from())));
        }
        if (f.to() != null) {
            where.append(" AND i.purchase_time < :to");
            params.put("to", DateRange.utc(DateRange.endExclusive(f.to())));
        }
        return where.toString();
    }

    private static Instant time(ResultSet rs, String column) throws SQLException {
        return DateRange.instant(rs.getObject(column, LocalDateTime.class));
    }

    private static OrderRow row(ResultSet rs, int n) throws SQLException {
        return new OrderRow(rs.getLong("id"), rs.getString("conversion_id"), rs.getString("order_id"),
            rs.getString("item_id"), rs.getString("item_name"), rs.getString("shop_name"), rs.getString("image_url"),
            rs.getInt("qty"), rs.getBigDecimal("item_price"), rs.getBigDecimal("actual_amount"),
            rs.getBigDecimal("refund_amount"), rs.getString("order_status"), rs.getString("fraud_status"),
            rs.getString("bucket"), rs.getBigDecimal("item_total_commission"), time(rs, "purchase_time"),
            time(rs, "complete_time"), rs.getString("utm_content"));
    }

    private static OrderDetail detail(ResultSet rs, int n) throws SQLException {
        OrderRow r = row(rs, n);
        return new OrderDetail(r.id(), r.conversionId(), r.orderId(), r.itemId(), r.itemName(), r.shopName(),
            r.imageUrl(), r.qty(), r.itemPrice(), r.actualAmount(), r.refundAmount(), r.orderStatus(), r.fraudStatus(),
            r.bucket(), r.commission(), r.purchaseTime(), r.completeTime(), r.utmContent(), rs.getString("model_id"),
            time(rs, "click_time"), rs.getString("buyer_type"), rs.getString("device"), rs.getString("referrer"),
            rs.getBigDecimal("item_seller_commission"), rs.getBigDecimal("item_shopee_commission"),
            rs.getBigDecimal("total_commission"), rs.getBigDecimal("net_commission"), time(rs, "validated_at"),
            rs.getObject("validation_id", Long.class), rs.getString("category_lv1"), rs.getString("item_notes"));
    }
}

package com.kira.farm.dashboard.infrastructure;

import com.kira.farm.order.domain.ShopOrder;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * Read-only aggregates for the admin dashboard and customer list. Native SQL read through closed interface
 * projections (columns are matched by alias); the caller always passes a non-empty branch scope computed by
 * BranchAccess. Revenue counts every order that is not CANCELLED, by creation time. Days are bucketed in Vietnam time
 * (UTC+7, no DST). Sums/counts are typed Number because MySQL returns BigDecimal or Long depending on the function.
 */
public interface DashboardRepository extends Repository<ShopOrder, Long> {
    interface RevenueRow {
        Number getRevenueToday();

        Number getOrdersToday();

        Number getRevenueMonth();

        Number getOrdersMonth();
    }

    interface NewCustomersRow {
        Number getToday();

        Number getMonth();
    }

    interface StatusRow {
        String getStatus();

        Number getTotal();
    }

    interface DayRow {
        /** ISO yyyy-MM-dd in Vietnam time. */
        String getDay();

        Number getRevenue();

        Number getOrders();
    }

    interface TopSellerRow {
        Number getProductId();

        String getName();

        Number getQuantity();

        Number getRevenue();
    }

    interface CustomerRow {
        Number getId();

        String getFullName();

        String getEmail();

        String getPhone();

        String getStatus();

        /** Driver-dependent timestamp type; convert with Rows.instant. */
        Object getCreatedAt();

        Number getOrderCount();

        Number getTotalSpent();
    }

    /** Today and month-to-date revenue/orders in one pass; `day` must not be before `month`. */
    @Query(value = "SELECT COALESCE(SUM(CASE WHEN created_at >= :day THEN total END), 0) AS revenueToday, "
        + "COUNT(CASE WHEN created_at >= :day THEN 1 END) AS ordersToday, COALESCE(SUM(total), 0) AS revenueMonth, "
        + "COUNT(*) AS ordersMonth FROM orders WHERE branch_id IN (:ids) AND status <> 'CANCELLED' "
        + "AND created_at >= :month AND created_at < :to", nativeQuery = true)
    RevenueRow revenue(@Param("ids") Collection<Long> ids, @Param("day") Instant day, @Param("month") Instant month,
                       @Param("to") Instant to);

    /** All statuses, including CANCELLED. */
    @Query(value = "SELECT status AS status, COUNT(*) AS total FROM orders WHERE branch_id IN (:ids) "
        + "AND created_at >= :from AND created_at < :to GROUP BY status", nativeQuery = true)
    List<StatusRow> statusCounts(@Param("ids") Collection<Long> ids, @Param("from") Instant from,
                                 @Param("to") Instant to);

    @Query(value = "SELECT CAST(DATE(DATE_ADD(created_at, INTERVAL 7 HOUR)) AS CHAR) AS day, "
        + "COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders "
        + "FROM orders WHERE branch_id IN (:ids) AND status <> 'CANCELLED' AND created_at >= :from AND created_at < :to "
        + "GROUP BY day ORDER BY day", nativeQuery = true)
    List<DayRow> daily(@Param("ids") Collection<Long> ids, @Param("from") Instant from, @Param("to") Instant to);

    @Query(value = "SELECT i.product_id AS productId, MAX(i.product_name) AS name, SUM(i.quantity) AS quantity, "
        + "SUM(i.line_total) AS revenue "
        + "FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.branch_id IN (:ids) "
        + "AND o.status <> 'CANCELLED' AND o.created_at >= :from AND o.created_at < :to "
        + "GROUP BY i.product_id ORDER BY quantity DESC LIMIT :limit", nativeQuery = true)
    List<TopSellerRow> topSellers(@Param("ids") Collection<Long> ids, @Param("from") Instant from,
                                  @Param("to") Instant to, @Param("limit") int limit);

    /** New customers today and month-to-date; all = 1: every customer, otherwise only those who ordered in `ids`. */
    @Query(value = "SELECT COUNT(CASE WHEN u.created_at >= :day THEN 1 END) AS today, COUNT(*) AS month FROM users u "
        + "WHERE u.role = 'CUSTOMER' AND u.created_at >= :month AND u.created_at < :to "
        + "AND (:all = 1 OR EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.branch_id IN (:ids)))",
        nativeQuery = true)
    NewCustomersRow newCustomers(@Param("all") int all, @Param("ids") Collection<Long> ids,
                                 @Param("day") Instant day, @Param("month") Instant month, @Param("to") Instant to);

    /**
     * Order stats only include the given branches; totalSpent is the sum of DELIVERED orders. all = 1 also lists
     * customers without orders.
     */
    @Query(value = "SELECT u.id AS id, u.full_name AS fullName, u.email AS email, u.phone AS phone, u.status AS status, "
        + "u.created_at AS createdAt, COUNT(o.id) AS orderCount, "
        + "COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total ELSE 0 END), 0) AS totalSpent "
        + "FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.branch_id IN (:ids) "
        + "WHERE u.role = 'CUSTOMER' AND (LOWER(u.full_name) LIKE :q OR LOWER(u.email) LIKE :q "
        + "OR COALESCE(u.phone, '') LIKE :q) AND (:all = 1 OR EXISTS (SELECT 1 FROM orders x "
        + "WHERE x.user_id = u.id AND x.branch_id IN (:ids))) "
        + "GROUP BY u.id, u.full_name, u.email, u.phone, u.status, u.created_at "
        + "ORDER BY u.id DESC LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<CustomerRow> customers(@Param("all") int all, @Param("ids") Collection<Long> ids, @Param("q") String q,
                                @Param("limit") int limit, @Param("offset") long offset);

    @Query(value = "SELECT COUNT(*) FROM users u WHERE u.role = 'CUSTOMER' AND (LOWER(u.full_name) LIKE :q "
        + "OR LOWER(u.email) LIKE :q OR COALESCE(u.phone, '') LIKE :q) AND (:all = 1 OR EXISTS (SELECT 1 FROM orders x "
        + "WHERE x.user_id = u.id AND x.branch_id IN (:ids)))", nativeQuery = true)
    long countCustomers(@Param("all") int all, @Param("ids") Collection<Long> ids, @Param("q") String q);
}

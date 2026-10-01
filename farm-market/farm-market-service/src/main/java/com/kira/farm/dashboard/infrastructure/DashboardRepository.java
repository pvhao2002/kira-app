package com.kira.farm.dashboard.infrastructure;

import com.kira.farm.order.domain.ShopOrder;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * Read-only aggregates for the admin dashboard and customer list. Native SQL; the caller always passes a non-empty
 * branch scope computed by BranchAccess. Revenue counts every order that is not CANCELLED, by creation time.
 * Days are bucketed in Vietnam time (UTC+7, no DST).
 */
public interface DashboardRepository extends Repository<ShopOrder, Long> {
    /** One row: [revenue, orderCount]. */
    @Query(value = "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM orders WHERE branch_id IN (:ids) "
        + "AND status <> 'CANCELLED' AND created_at >= :from AND created_at < :to", nativeQuery = true)
    List<Object[]> revenue(@Param("ids") Collection<Long> ids, @Param("from") Instant from, @Param("to") Instant to);

    /** Rows: [status, count] (all statuses, including CANCELLED). */
    @Query(value = "SELECT status, COUNT(*) FROM orders WHERE branch_id IN (:ids) "
        + "AND created_at >= :from AND created_at < :to GROUP BY status", nativeQuery = true)
    List<Object[]> statusCounts(@Param("ids") Collection<Long> ids, @Param("from") Instant from, @Param("to") Instant to);

    /** Rows: [day, revenue, orderCount]. */
    @Query(value = "SELECT DATE(DATE_ADD(created_at, INTERVAL 7 HOUR)) AS d, COALESCE(SUM(total), 0), COUNT(*) "
        + "FROM orders WHERE branch_id IN (:ids) AND status <> 'CANCELLED' AND created_at >= :from AND created_at < :to "
        + "GROUP BY d ORDER BY d", nativeQuery = true)
    List<Object[]> daily(@Param("ids") Collection<Long> ids, @Param("from") Instant from, @Param("to") Instant to);

    /** Rows: [productId, name, quantity, revenue]. */
    @Query(value = "SELECT i.product_id, MAX(i.product_name), SUM(i.quantity) AS qty, SUM(i.line_total) "
        + "FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.branch_id IN (:ids) "
        + "AND o.status <> 'CANCELLED' AND o.created_at >= :from AND o.created_at < :to "
        + "GROUP BY i.product_id ORDER BY qty DESC LIMIT :limit", nativeQuery = true)
    List<Object[]> topSellers(@Param("ids") Collection<Long> ids, @Param("from") Instant from, @Param("to") Instant to,
                              @Param("limit") int limit);

    /** all = 1: every customer; otherwise only customers who ordered in the given branches. */
    @Query(value = "SELECT COUNT(*) FROM users u WHERE u.role = 'CUSTOMER' AND u.created_at >= :from "
        + "AND u.created_at < :to AND (:all = 1 OR EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id "
        + "AND o.branch_id IN (:ids)))", nativeQuery = true)
    long newCustomers(@Param("all") int all, @Param("ids") Collection<Long> ids, @Param("from") Instant from,
                      @Param("to") Instant to);

    /**
     * Rows: [id, fullName, email, phone, status, createdAt, orderCount, totalSpent]. Order stats only include the
     * given branches; totalSpent is the sum of DELIVERED orders. all = 1 also lists customers without orders.
     */
    @Query(value = "SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, COUNT(o.id), "
        + "COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total ELSE 0 END), 0) "
        + "FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.branch_id IN (:ids) "
        + "WHERE u.role = 'CUSTOMER' AND (LOWER(u.full_name) LIKE :q OR LOWER(u.email) LIKE :q "
        + "OR COALESCE(u.phone, '') LIKE :q) AND (:all = 1 OR EXISTS (SELECT 1 FROM orders x "
        + "WHERE x.user_id = u.id AND x.branch_id IN (:ids))) "
        + "GROUP BY u.id, u.full_name, u.email, u.phone, u.status, u.created_at "
        + "ORDER BY u.id DESC LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<Object[]> customers(@Param("all") int all, @Param("ids") Collection<Long> ids, @Param("q") String q,
                             @Param("limit") int limit, @Param("offset") long offset);

    @Query(value = "SELECT COUNT(*) FROM users u WHERE u.role = 'CUSTOMER' AND (LOWER(u.full_name) LIKE :q "
        + "OR LOWER(u.email) LIKE :q OR COALESCE(u.phone, '') LIKE :q) AND (:all = 1 OR EXISTS (SELECT 1 FROM orders x "
        + "WHERE x.user_id = u.id AND x.branch_id IN (:ids)))", nativeQuery = true)
    long countCustomers(@Param("all") int all, @Param("ids") Collection<Long> ids, @Param("q") String q);
}

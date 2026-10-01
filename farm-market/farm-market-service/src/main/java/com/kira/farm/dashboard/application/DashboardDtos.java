package com.kira.farm.dashboard.application;

import com.kira.farm.identity.domain.UserStatus;
import com.kira.farm.order.domain.OrderStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class DashboardDtos {
    private DashboardDtos() {
    }

    /** Revenue = total of non-cancelled orders by creation date (VND); "month" = calendar month so far. */
    public record Kpis(long revenueToday, long revenueMonth, long ordersToday, long ordersMonth,
                       long newCustomersToday, long newCustomersMonth) {
    }

    public record DayPoint(LocalDate date, long revenue, long orders) {
    }

    public record TopSeller(Long productId, String name, long quantity, long revenue) {
    }

    public record LowStockItem(Long productId, String sku, String name, Long branchId, int available, String level) {
    }

    /** ordersByStatus and the series cover the last `days` days (including today). */
    public record DashboardResponse(Long branchId, int days, Kpis kpis, Map<OrderStatus, Long> ordersByStatus,
                                    List<DayPoint> revenueSeries, List<TopSeller> topSellers,
                                    List<LowStockItem> lowStock) {
    }

    public record CustomerResponse(Long id, String fullName, String email, String phone, UserStatus status,
                                   Instant createdAt, long orderCount, long totalSpent) {
    }
}

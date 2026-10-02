package com.kira.farm.dashboard.application;

import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.dashboard.infrastructure.DashboardRepository;
import com.kira.farm.inventory.application.InventoryRow;
import com.kira.farm.inventory.infrastructure.InventoryRepository;
import com.kira.farm.order.domain.OrderStatus;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

import static com.kira.farm.dashboard.application.DashboardDtos.*;

/** Admin dashboard, always scoped by BranchAccess (staff/manager: assigned branches only). */
@Service
@RequiredArgsConstructor
public class DashboardService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_DAYS = 365;

    private final DashboardRepository repo;
    private final InventoryRepository inventory;
    private final BranchAccess access;

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(Long branchId, int days) {
        if (days < 1 || days > MAX_DAYS)
            throw ApiException.badRequest("INVALID_PARAMETER", "Số ngày phải từ 1 đến " + MAX_DAYS);
        Set<Long> scope = access.scope(branchId);

        LocalDate today = LocalDate.now(VN);
        Instant startToday = today.atStartOfDay(VN).toInstant();
        Instant endToday = today.plusDays(1).atStartOfDay(VN).toInstant();
        Instant startMonth = today.withDayOfMonth(1).atStartOfDay(VN).toInstant();
        LocalDate firstDay = today.minusDays(days - 1L);
        Instant startRange = firstDay.atStartOfDay(VN).toInstant();

        Map<OrderStatus, Long> byStatus = new EnumMap<>(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) byStatus.put(s, 0L);
        if (scope.isEmpty())
            return new DashboardResponse(branchId, days, new Kpis(0, 0, 0, 0, 0, 0), byStatus, series(firstDay, today, Map.of()),
                List.of(), List.of());

        boolean all = CurrentUser.require().isAdmin() && branchId == null;
        var revenue = repo.revenue(scope, startToday, startMonth, endToday);
        var customers = repo.newCustomers(all ? 1 : 0, scope, startToday, startMonth, endToday);
        Kpis kpis = new Kpis(revenue.getRevenueToday().longValue(), revenue.getRevenueMonth().longValue(),
            revenue.getOrdersToday().longValue(), revenue.getOrdersMonth().longValue(),
            customers.getToday().longValue(), customers.getMonth().longValue());

        for (var row : repo.statusCounts(scope, startRange, endToday))
            byStatus.put(OrderStatus.valueOf(row.getStatus()), row.getTotal().longValue());

        Map<LocalDate, DayPoint> daily = new HashMap<>();
        for (var row : repo.daily(scope, startRange, endToday)) {
            LocalDate d = LocalDate.parse(row.getDay());
            daily.put(d, new DayPoint(d, row.getRevenue().longValue(), row.getOrders().longValue()));
        }
        List<TopSeller> top = repo.topSellers(scope, startRange, endToday, 5).stream()
            .map(r -> new TopSeller(r.getProductId().longValue(), r.getName(), r.getQuantity().longValue(),
                r.getRevenue().longValue())).toList();
        List<LowStockItem> low = inventory.lowStock(scope, InventoryRow.LOW_STOCK_LIMIT - 1, PageRequest.of(0, 10)).stream()
            .map(i -> new LowStockItem(i.productId(), i.sku(), i.name(), i.branchId(), i.available(), i.level())).toList();
        return new DashboardResponse(branchId, days, kpis, byStatus, series(firstDay, today, daily), top, low);
    }

    /** One point per day, zero-filled. */
    private static List<DayPoint> series(LocalDate from, LocalDate to, Map<LocalDate, DayPoint> byDay) {
        List<DayPoint> points = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1))
            points.add(byDay.getOrDefault(d, new DayPoint(d, 0, 0)));
        return points;
    }
}

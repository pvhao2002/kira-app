package com.kira.farm.dashboard.application;

import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.dashboard.infrastructure.DashboardRepository;
import com.kira.farm.inventory.application.InventoryRow;
import com.kira.farm.inventory.infrastructure.InventoryRepository;
import com.kira.farm.order.domain.OrderStatus;
import com.kira.farm.shared.infrastructure.Rows;
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

        long[] day = revenue(scope, startToday, endToday);
        long[] month = revenue(scope, startMonth, endToday);
        boolean all = CurrentUser.require().isAdmin() && branchId == null;
        int allFlag = all ? 1 : 0;
        Kpis kpis = new Kpis(day[0], month[0], day[1], month[1],
            repo.newCustomers(allFlag, scope, startToday, endToday), repo.newCustomers(allFlag, scope, startMonth, endToday));

        for (Object[] row : repo.statusCounts(scope, startRange, endToday))
            byStatus.put(OrderStatus.valueOf((String) row[0]), Rows.num(row[1]));

        Map<LocalDate, DayPoint> daily = new HashMap<>();
        for (Object[] row : repo.daily(scope, startRange, endToday)) {
            LocalDate d = Rows.date(row[0]);
            daily.put(d, new DayPoint(d, Rows.num(row[1]), Rows.num(row[2])));
        }
        List<TopSeller> top = repo.topSellers(scope, startRange, endToday, 5).stream()
            .map(r -> new TopSeller(Rows.num(r[0]), (String) r[1], Rows.num(r[2]), Rows.num(r[3]))).toList();
        List<LowStockItem> low = inventory.search(scope, "%%", Integer.MIN_VALUE, InventoryRow.LOW_STOCK_LIMIT - 1,
                PageRequest.of(0, 10)).getContent().stream()
            .map(i -> new LowStockItem(i.productId(), i.sku(), i.name(), i.branchId(), i.available(), i.level())).toList();
        return new DashboardResponse(branchId, days, kpis, byStatus, series(firstDay, today, daily), top, low);
    }

    private long[] revenue(Set<Long> scope, Instant from, Instant to) {
        Object[] row = repo.revenue(scope, from, to).getFirst();
        return new long[]{Rows.num(row[0]), Rows.num(row[1])};
    }

    /** One point per day, zero-filled. */
    private static List<DayPoint> series(LocalDate from, LocalDate to, Map<LocalDate, DayPoint> byDay) {
        List<DayPoint> points = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1))
            points.add(byDay.getOrDefault(d, new DayPoint(d, 0, 0)));
        return points;
    }
}

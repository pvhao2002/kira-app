package com.kira.farm.dashboard.application;

import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.dashboard.infrastructure.DashboardRepository;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import com.kira.farm.identity.domain.UserStatus;
import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.shared.infrastructure.Rows;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageMeta;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import static com.kira.farm.dashboard.application.DashboardDtos.CustomerResponse;

/**
 * Customer management. Admin lists every customer; staff/manager only customers who ordered in their branches
 * (order stats then cover those branches only). Locking is admin-only.
 */
@Service
@RequiredArgsConstructor
public class CustomerAdminService {
    private final DashboardRepository repo;
    private final UserRepository users;
    private final BranchAccess access;

    @Transactional(readOnly = true)
    public PageResponse<CustomerResponse> list(String q, int page, int size) {
        var pageable = Paging.of(page, size);
        Set<Long> scope = access.accessibleBranchIds();
        boolean admin = CurrentUser.require().isAdmin();
        if (scope.isEmpty() && !admin) return new PageResponse<>(List.of(), PageMeta.empty(page, size));
        List<Long> ids = scope.isEmpty() ? List.of(-1L) : List.copyOf(scope);
        int all = admin ? 1 : 0;
        String like = "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)) + "%";
        long total = repo.countCustomers(all, ids, like);
        List<CustomerResponse> data = repo.customers(all, ids, like, size, pageable.getOffset()).stream()
            .map(r -> new CustomerResponse(r.getId().longValue(), r.getFullName(), r.getEmail(), r.getPhone(),
                UserStatus.valueOf(r.getStatus()), Rows.instant(r.getCreatedAt()), r.getOrderCount().longValue(),
                r.getTotalSpent().longValue())).toList();
        return new PageResponse<>(data, new PageMeta(page, size, total, (int) Math.ceil(total / (double) size)));
    }

    @Transactional
    public void setLocked(Long id, boolean locked) {
        User u = users.findById(id).filter(x -> x.getRole() == Role.CUSTOMER)
            .orElseThrow(() -> ApiException.notFound("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng"));
        u.setStatus(locked ? UserStatus.LOCKED : UserStatus.ACTIVE);
        users.save(u);
    }
}

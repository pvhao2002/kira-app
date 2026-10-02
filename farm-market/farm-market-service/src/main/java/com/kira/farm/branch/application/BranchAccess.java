package com.kira.farm.branch.application;

import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.shared.security.AuthPrincipal;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Single place that decides which branches the current back-office user may touch. Admin: every branch.
 * Staff/manager: only assigned branches. Customers: none. Other capabilities call this instead of trusting a
 * branch id coming from the client.
 */
@Component
@RequiredArgsConstructor
public class BranchAccess {
    private final BranchRepository branches;

    public Set<Long> accessibleBranchIds() {
        AuthPrincipal p = CurrentUser.require();
        if (!p.isBackoffice()) throw denied();
        if (p.isAdmin()) return Set.copyOf(branches.findAllIds());
        return Set.copyOf(p.branchIds());
    }

    public boolean canAccess(Long branchId) {
        AuthPrincipal p = CurrentUser.require();
        if (!p.isBackoffice() || branchId == null) return false;
        return p.isAdmin() ? branches.existsById(branchId) : p.branchIds().contains(branchId);
    }

    /** Throws 403 BRANCH_FORBIDDEN unless the caller may work in this branch. */
    public void require(Long branchId) {
        if (!canAccess(branchId)) throw denied();
    }

    /**
     * Branch ids a list endpoint should filter by: the requested branch (after an access check) or, when none
     * is requested, everything the caller can access.
     */
    public Set<Long> scope(Long requestedBranchId) {
        if (requestedBranchId == null) return accessibleBranchIds();
        require(requestedBranchId);
        return Set.of(requestedBranchId);
    }

    private static ApiException denied() {
        return ApiException.forbidden("BRANCH_FORBIDDEN", "Bạn không có quyền với chi nhánh này");
    }
}

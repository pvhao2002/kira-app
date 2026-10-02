package com.kira.farm.identity.application;

import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import com.kira.farm.identity.domain.UserStatus;
import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.Paging;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Admin-only (enforced in the controller): user directory and staff/manager branch assignment. */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {
    private final UserRepository users;
    private final BranchRepository branches;

    public record UserSummary(Long id, String email, String fullName, Role role, UserStatus status,
                              List<Long> branchIds, Instant createdAt) {
        static UserSummary of(User u) {
            return new UserSummary(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getStatus(),
                u.getBranchIds().stream().sorted().toList(), u.getCreatedAt());
        }
    }

    public record BranchAssignmentRequest(@NotNull @Size(max = 50) Set<Long> branchIds) {
    }

    /** role is optional; without it staff, managers and admins are listed (customers have their own endpoint). */
    @Transactional(readOnly = true)
    public PageResponse<UserSummary> list(Role role, String q, int page, int size) {
        if (role == Role.CUSTOMER) throw ApiException.badRequest("INVALID_PARAMETER", "Dùng danh sách khách hàng cho vai trò này");
        List<Role> roles = role == null ? Arrays.stream(Role.values()).filter(r -> r != Role.CUSTOMER).toList() : List.of(role);
        String like = "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)) + "%";
        return PageResponse.of(users.searchByRole(roles, like, Paging.of(page, size)), UserSummary::of);
    }

    /** Clears the TOTP secret so the person must enroll again at next login. Never returns the secret. */
    @Transactional
    public void resetOtp(Long id, Long adminId) {
        User u = users.requireById(id);
        u.setTotpSecret(null);
        u.setTotpEnabled(false);
        u.setTotpLastStep(null);
        users.save(u);
        log.info("OTP reset for user {} by admin {}", id, adminId);
    }

    /** Replaces the user's branch assignments. Only STAFF and MANAGER accounts are branch-scoped. */
    @Transactional
    public UserSummary assignBranches(Long id, BranchAssignmentRequest r) {
        User u = users.requireById(id);
        if (u.getRole() != Role.STAFF && u.getRole() != Role.MANAGER)
            throw ApiException.unprocessable("USER_NOT_BRANCH_SCOPED", "Chỉ nhân viên và quản lý mới được gán chi nhánh");
        if (branches.findAllById(r.branchIds()).size() != r.branchIds().size())
            throw ApiException.badRequest("BRANCH_NOT_FOUND", "Chi nhánh không tồn tại");
        u.getBranchIds().clear();
        u.getBranchIds().addAll(r.branchIds());
        return UserSummary.of(users.saveAndFlush(u));
    }
}

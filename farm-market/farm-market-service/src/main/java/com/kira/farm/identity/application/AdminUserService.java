package com.kira.farm.identity.application;

import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import com.kira.farm.identity.domain.UserStatus;
import com.kira.farm.identity.infrastructure.RefreshTokenRepository;
import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.Paging;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private final PasswordEncoder encoder;
    private final RefreshTokenRepository refreshTokens;

    public record UserSummary(Long id, String email, String fullName, Role role, UserStatus status,
                              List<Long> branchIds, Instant createdAt) {
        static UserSummary of(User u) {
            return new UserSummary(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getStatus(),
                u.getBranchIds().stream().sorted().toList(), u.getCreatedAt());
        }
    }

    public record BranchAssignmentRequest(@NotNull @Size(max = 50) Set<Long> branchIds) {
    }

    /** Admin provisions a back-office account with a temporary password; TOTP is enrolled by the user at first login. */
    public record CreateUserRequest(
        @NotBlank(message = "Vui lòng nhập họ tên") @Size(max = 120) String fullName,
        @NotBlank(message = "Vui lòng nhập email") @Email(message = "Email không hợp lệ") @Size(max = 190) String email,
        @Pattern(regexp = AuthDtos.PHONE_REGEX, message = AuthDtos.PHONE_MESSAGE) String phone,
        @NotBlank(message = "Vui lòng nhập mật khẩu tạm") @Size(min = 8, max = 72, message = AuthDtos.PASSWORD_MESSAGE) String password,
        @NotNull(message = "Vui lòng chọn vai trò") Role role,
        @Size(max = 50) Set<Long> branchIds) {
    }

    public record ChangeRoleRequest(@NotNull(message = "Vui lòng chọn vai trò") Role role) {
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
        requireBranches(r.branchIds());
        u.getBranchIds().clear();
        u.getBranchIds().addAll(r.branchIds());
        return UserSummary.of(users.saveAndFlush(u));
    }

    @Transactional
    public UserSummary create(CreateUserRequest r) {
        requireBackoffice(r.role());
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        String phone = AuthService.normalizePhone(r.phone());
        if (users.existsByEmailIgnoreCase(email))
            throw ApiException.conflict("EMAIL_EXISTS", "Email đã được sử dụng");
        if (phone != null && users.existsByPhone(phone))
            throw ApiException.conflict("PHONE_EXISTS", "Số điện thoại đã được sử dụng");
        Set<Long> branchIds = r.role() == Role.ADMIN || r.branchIds() == null ? Set.of() : r.branchIds();
        requireBranches(branchIds);
        User u = new User();
        u.setEmail(email);
        u.setPhone(phone);
        u.setFullName(r.fullName().trim());
        u.setPasswordHash(encoder.encode(r.password()));
        u.setRole(r.role());
        u.getBranchIds().addAll(branchIds);
        UserSummary summary = UserSummary.of(users.saveAndFlush(u));
        log.info("User {} created with role {}", summary.id(), r.role());
        return summary;
    }

    /**
     * Changes a back-office role. An admin cannot change their own role, the last active admin cannot be demoted,
     * becoming ADMIN drops branch assignments (other role changes keep them), and the user's refresh tokens are revoked.
     */
    @Transactional
    public UserSummary changeRole(Long id, Long actorId, ChangeRoleRequest r) {
        if (id.equals(actorId))
            throw ApiException.unprocessable("CANNOT_CHANGE_OWN_ROLE", "Bạn không thể tự đổi vai trò của mình");
        requireBackoffice(r.role());
        User u = users.requireById(id);
        if (!u.getRole().isBackoffice())
            throw ApiException.unprocessable("USER_NOT_BACKOFFICE", "Chỉ đổi vai trò cho tài khoản nhân viên, quản lý hoặc quản trị");
        if (u.getRole() == Role.ADMIN && r.role() != Role.ADMIN
            && users.countByRoleAndStatusAndIdNot(Role.ADMIN, UserStatus.ACTIVE, id) == 0)
            throw ApiException.unprocessable("LAST_ADMIN", "Phải còn ít nhất một quản trị viên đang hoạt động");
        u.setRole(r.role());
        if (r.role() == Role.ADMIN) u.getBranchIds().clear();
        UserSummary summary = UserSummary.of(users.saveAndFlush(u));
        refreshTokens.revokeAllByUser(id, Instant.now());
        log.info("Role of user {} changed to {} by admin {}", id, r.role(), actorId);
        return summary;
    }

    private static void requireBackoffice(Role role) {
        if (role == null || role == Role.CUSTOMER)
            throw ApiException.unprocessable("INVALID_ROLE", "Vai trò phải là nhân viên, quản lý hoặc quản trị viên");
    }

    private void requireBranches(Set<Long> ids) {
        if (branches.findAllById(ids).size() != ids.size())
            throw ApiException.badRequest("BRANCH_NOT_FOUND", "Chi nhánh không tồn tại");
    }
}

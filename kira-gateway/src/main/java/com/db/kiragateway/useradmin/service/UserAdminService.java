package com.db.kiragateway.useradmin.service;

import com.db.kiragateway.useradmin.dto.CreateUserRequest;
import com.db.kiragateway.useradmin.dto.ResetPasswordRequest;
import com.db.kiragateway.useradmin.dto.UpdateUserRequest;
import com.db.kiragateway.useradmin.dto.UserAdminPage;
import com.db.kiragateway.useradmin.model.UserAdminRow;
import com.db.kiragateway.useradmin.repository.UserAdminRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Set;

@Service
public class UserAdminService {

    private static final Set<String> ROLES = Set.of("admin", "user", "moderator");
    private static final Set<String> STATUSES = Set.of("active", "locked", "pending");

    private final UserAdminRepository userAdminRepository;
    private final PasswordEncoder passwordEncoder;

    public UserAdminService(UserAdminRepository userAdminRepository, PasswordEncoder passwordEncoder) {
        this.userAdminRepository = userAdminRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserAdminPage list(
            int page,
            int size,
            String q,
            String status,
            String role,
            String sortBy,
            String sortDir
    ) {
        int p = Math.max(0, page);
        int s = Math.clamp(size, 1, 100);
        String usernameLike = (StringUtils.hasText(q)) ? likePattern(q) : null;
        String statusFilter = null;
        if (StringUtils.hasText(status) && !"all".equalsIgnoreCase(status.trim())) {
            statusFilter = normalizeStatusFilter(status.trim());
        }
        String roleFilter = null;
        if (StringUtils.hasText(role)) {
            roleFilter = requireAllowedRole(role.trim());
        }
        String orderCol = resolveSortColumn(sortBy);
        String orderDirection = resolveSortDir(sortDir);

        long total = userAdminRepository.count(usernameLike, statusFilter, roleFilter);
        int totalPages = total == 0 ? 0 : (int) ((total + s - 1) / s);
        var rows = userAdminRepository.findPage(
                usernameLike,
                statusFilter,
                roleFilter,
                orderCol,
                orderDirection,
                p * s,
                s
        );
        return new UserAdminPage(rows, p, s, total, totalPages);
    }

    public UserAdminRow create(CreateUserRequest request) {
        var username = request.username().trim();
        if (userAdminRepository.existsByUsername(username)) {
            throw new IllegalStateException("Username already exists");
        }
        var role = normalizeRoleOrDefault(request.role());
        var hash = passwordEncoder.encode(request.password());
        int n = userAdminRepository.insert(username, hash, "active", role);
        if (n <= 0) {
            throw new IllegalStateException("Could not create user");
        }
        return userAdminRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Could not load created user"));
    }

    public UserAdminRow update(int userId, UpdateUserRequest request) {
        if (userAdminRepository.findById(userId).isEmpty()) {
            throw new IllegalArgumentException("User not found");
        }

        String newRole = request.role() != null && StringUtils.hasText(request.role())
                ? requireAllowedRole(request.role().trim())
                : null;
        String newStatus = request.status() != null && StringUtils.hasText(request.status())
                ? normalizeStatusForWrite(request.status().trim())
                : null;

        if (newRole == null && newStatus == null) {
            throw new IllegalArgumentException("role or status is required");
        }

        int updated = userAdminRepository.updateRoleStatus(userId, newRole, newStatus);
        if (updated <= 0) {
            throw new IllegalArgumentException("User not found or nothing to update");
        }
        return userAdminRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    public void resetPassword(int userId, ResetPasswordRequest request) {
        if (userAdminRepository.findById(userId).isEmpty()) {
            throw new IllegalArgumentException("User not found");
        }
        var hash = passwordEncoder.encode(request.password());
        if (userAdminRepository.updatePassword(userId, hash) <= 0) {
            throw new IllegalArgumentException("User not found");
        }
    }

    public void delete(int userId, int currentUserId) {
        if (userId == currentUserId) {
            throw new IllegalStateException("Cannot delete your own account");
        }
        if (userAdminRepository.findById(userId).isEmpty()) {
            throw new IllegalArgumentException("User not found");
        }
        if (userAdminRepository.deleteById(userId) <= 0) {
            throw new IllegalArgumentException("User not found");
        }
    }

    /** Escape LIKE wildcards; use with `escape '!'` in SQL. */
    public static String likePattern(String raw) {
        var s = raw.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + s + "%";
    }

    private static String normalizeStatusFilter(String status) {
        var s = status.toLowerCase(Locale.ROOT);
        if (!STATUSES.contains(s)) {
            throw new IllegalArgumentException("Invalid status filter: " + status);
        }
        return s;
    }

    private static String normalizeStatusForWrite(String status) {
        var s = status.toLowerCase(Locale.ROOT);
        if ("enabled".equals(s)) {
            s = "active";
        }
        if (!STATUSES.contains(s)) {
            throw new IllegalArgumentException("Invalid status: " + status);
        }
        return s;
    }

    private static String normalizeRoleOrDefault(String role) {
        if (!StringUtils.hasText(role)) {
            return "user";
        }
        return requireAllowedRole(role.trim());
    }

    private static String requireAllowedRole(String role) {
        var r = role.toLowerCase(Locale.ROOT);
        if (!ROLES.contains(r)) {
            throw new IllegalArgumentException("Invalid role: " + role);
        }
        return r;
    }

    private static String resolveSortColumn(String sortBy) {
        if (!StringUtils.hasText(sortBy)) {
            return "created_at";
        }
        var key = sortBy.trim().toLowerCase(Locale.ROOT);
        return switch (key) {
            case "updated_at", "username", "created_at" -> key;
            default -> throw new IllegalArgumentException("Invalid sortBy: " + sortBy);
        };
    }

    private static String resolveSortDir(String sortDir) {
        if (!StringUtils.hasText(sortDir)) {
            return "desc";
        }
        var d = sortDir.trim().toLowerCase(Locale.ROOT);
        if ("asc".equals(d) || "desc".equals(d)) {
            return d;
        }
        throw new IllegalArgumentException("Invalid sortDir: " + sortDir);
    }
}

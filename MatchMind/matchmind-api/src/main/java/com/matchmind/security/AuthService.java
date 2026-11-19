package com.matchmind.security;

import com.matchmind.shared.ApiException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginRateLimiter limiter;
    private volatile String dummyHash;

    public record LoginRequest(@NotBlank @Size(max = 64) String username, @NotBlank @Size(max = 128) String password) {
    }

    public record LoginResponse(String accessToken, Instant expiresAt, UserView user) {
    }

    public record UserView(UUID id, String username, String role, String status, Instant lastLoginAt,
                           Instant createdAt, Instant updatedAt) {
        static UserView of(User u) {
            return new UserView(u.getId(), u.getUsername(), u.getRole(), u.getStatus(), u.getLastLoginAt(),
                u.getCreatedAt(), u.getUpdatedAt());
        }
    }

    public record ChangePasswordRequest(@NotBlank @Size(max = 128) String currentPassword,
                                        @NotBlank @Size(min = 10, max = 72) String newPassword) {
    }

    public record CreateUserRequest(@NotBlank @Pattern(regexp = "^[A-Za-z0-9._-]{3,64}$") String username,
                                    @NotBlank @Size(min = 10, max = 72) String password,
                                    @NotBlank @Pattern(regexp = "ADMIN|VIEWER") String role) {
    }

    public record UpdateUserRequest(@Pattern(regexp = "ADMIN|VIEWER") String role,
                                    @Pattern(regexp = "ACTIVE|DISABLED") String status) {
    }

    public record ResetPasswordRequest(@NotBlank @Size(min = 10, max = 72) String newPassword) {
    }

    /** Not transactional: the slow bcrypt check must not hold a pool connection. */
    public LoginResponse login(LoginRequest r, String ip) {
        limiter.acquire(ip, r.username());
        User user = users.findByUsernameIgnoreCase(r.username().trim()).orElse(null);
        // Same bcrypt cost for unknown users and over-long passwords, so timing reveals nothing.
        boolean ok;
        if (user == null || tooLongForBcrypt(r.password())) {
            encoder.matches("not-the-password", dummyHash());
            ok = false;
        } else {
            ok = encoder.matches(r.password(), user.getPasswordHash());
        }
        if (!ok || !user.active()) {
            limiter.recordFailure(r.username());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Invalid username or password");
        }
        limiter.recordSuccess(r.username());
        user.setLastLoginAt(Instant.now());
        users.save(user);
        JwtService.Issued issued = jwt.issue(user);
        return new LoginResponse(issued.token(), issued.expiresAt(), UserView.of(user));
    }

    /** Invalidates every token of the user (stateless JWTs are revoked through token_version). */
    @Transactional
    public void logout(UUID userId) {
        users.findById(userId).ifPresent(u -> u.setTokenVersion(u.getTokenVersion() + 1));
    }

    @Transactional(readOnly = true)
    public UserView me(UUID userId) {
        return UserView.of(require(userId));
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest r) {
        User u = require(userId);
        if (!encoder.matches(r.currentPassword(), u.getPasswordHash())) {
            throw ApiException.badRequest("BAD_CURRENT_PASSWORD", "Current password is incorrect");
        }
        u.setPasswordHash(encoder.encode(checkBcryptLimit("newPassword", r.newPassword())));
        u.setTokenVersion(u.getTokenVersion() + 1);
    }

    @Transactional(readOnly = true)
    public List<UserView> list() {
        return users.findAllByOrderByUsernameAsc().stream().map(UserView::of).toList();
    }

    @Transactional
    public UserView create(CreateUserRequest r) {
        if (users.findByUsernameIgnoreCase(r.username()).isPresent()) {
            throw ApiException.conflict("USERNAME_EXISTS", "Username already exists");
        }
        User u = new User();
        u.setUsername(r.username());
        u.setPasswordHash(encoder.encode(checkBcryptLimit("password", r.password())));
        u.setRole(r.role());
        return UserView.of(users.saveAndFlush(u));
    }

    @Transactional
    public UserView update(UUID actorId, UUID id, UpdateUserRequest r) {
        User u = require(id);
        boolean demotesSelf = id.equals(actorId) && (("VIEWER".equals(r.role())) || "DISABLED".equals(r.status()));
        if (demotesSelf) throw ApiException.badRequest("SELF_LOCKOUT", "You cannot demote or disable your own account");
        if (r.role() != null) u.setRole(r.role());
        if (r.status() != null && !r.status().equals(u.getStatus())) {
            u.setStatus(r.status());
            u.setTokenVersion(u.getTokenVersion() + 1);
        }
        return UserView.of(users.saveAndFlush(u));
    }

    @Transactional
    public void resetPassword(UUID id, ResetPasswordRequest r) {
        User u = require(id);
        u.setPasswordHash(encoder.encode(checkBcryptLimit("newPassword", r.newPassword())));
        u.setTokenVersion(u.getTokenVersion() + 1);
    }

    /** bcrypt only reads 72 bytes and rejects longer input; @Size counts characters, not bytes. */
    static boolean tooLongForBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > 72;
    }

    private static String checkBcryptLimit(String field, String password) {
        if (tooLongForBcrypt(password)) {
            String message = "must be at most 72 bytes (accented letters count as 2-3 bytes)";
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Password is too long", Map.of(field, message));
        }
        return password;
    }

    private User require(UUID id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found"));
    }

    private String dummyHash() {
        String h = dummyHash;
        if (h == null) dummyHash = h = encoder.encode(UUID.randomUUID().toString());
        return h;
    }
}

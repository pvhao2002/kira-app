package com.matchmind.security;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
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
    private final RevokedTokens revoked;
    private final UserAudit audit;
    private final ApplicationEventPublisher events;
    private volatile String dummyHash;

    public record LoginRequest(@NotBlank @Size(max = 64) String username, @NotBlank @Size(max = 128) String password) {
    }

    public record LoginResponse(String accessToken, Instant expiresAt, UserView user) {
    }

    public record UserView(UUID id, String username, String role, String status, Instant lastLoginAt,
                           Instant createdAt, Instant updatedAt, boolean mustChangePassword, boolean loginLocked) {
        static UserView of(User u) {
            return of(u, false);
        }

        static UserView of(User u, boolean loginLocked) {
            return new UserView(u.getId(), u.getUsername(), u.getRole(), u.getStatus(), u.getLastLoginAt(),
                u.getCreatedAt(), u.getUpdatedAt(), u.isMustChangePassword(), loginLocked);
        }
    }

    public record ChangePasswordRequest(@NotBlank @Size(max = 128) String currentPassword,
                                        @NotBlank @Size(min = 10, max = 72) String newPassword) {
    }

    public record CreateUserRequest(@NotBlank @Pattern(regexp = "^[A-Za-z0-9._-]{3,64}$") String username,
                                    @NotBlank @Size(min = 10, max = 72) String password,
                                    @NotBlank @Pattern(regexp = "ADMIN|VIEWER") String role,
                                    Boolean mustChangePassword) {
    }

    public record UpdateUserRequest(@Pattern(regexp = "ADMIN|VIEWER") String role,
                                    @Pattern(regexp = "ACTIVE|DISABLED") String status) {
    }

    public record ResetPasswordRequest(@NotBlank @Size(min = 10, max = 72) String newPassword, Boolean mustChangePassword) {
    }

    public record GeneratedPassword(String password) {
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
            limiter.recordFailure(ip, r.username());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Invalid username or password");
        }
        limiter.recordSuccess(ip, r.username());
        user.setLastLoginAt(Instant.now());
        users.save(user);
        JwtService.Issued issued = jwt.issue(user);
        return new LoginResponse(issued.token(), issued.expiresAt(), UserView.of(user));
    }

    /** Ends only the session that made this request. A token without an id (issued before ids existed) ends them all. */
    @Transactional
    public void logout(UserPrincipal me) {
        if (me.tokenId() == null || me.tokenExpiresAt() == null) {
            logoutEverywhere(me.id());
            return;
        }
        revoked.revoke(me.tokenId(), me.tokenExpiresAt());
        events.publishEvent(new SessionsRevoked(me.id(), me.tokenId()));
    }

    /** Invalidates every token of the user (stateless JWTs are revoked through token_version). */
    @Transactional
    public void logoutEverywhere(UUID userId) {
        users.findById(userId).ifPresent(u -> u.setTokenVersion(u.getTokenVersion() + 1));
        events.publishEvent(new SessionsRevoked(userId, null));
    }

    /**
     * A new token for an active session: sliding expiry, but never later than {@code app.jwt.max-session} after the
     * password sign-in. The old token stays valid until it expires (clients swap tokens without a race).
     */
    @Transactional(readOnly = true)
    public LoginResponse refresh(UserPrincipal me) {
        User user = require(me.id());
        Instant sessionStart = me.sessionStartedAt() == null ? Instant.now() : me.sessionStartedAt();
        JwtService.Issued issued = jwt.issue(user, sessionStart);
        return new LoginResponse(issued.token(), issued.expiresAt(), UserView.of(user));
    }

    @Transactional(readOnly = true)
    public UserView me(UUID userId) {
        return UserView.of(require(userId));
    }

    @Transactional
    public void changePassword(UserPrincipal me, ChangePasswordRequest r, String ip) {
        limiter.acquirePasswordChange(me.id());
        User u = require(me.id());
        if (!encoder.matches(r.currentPassword(), u.getPasswordHash())) {
            limiter.recordPasswordChangeFailure(me.id());
            throw ApiException.badRequest("BAD_CURRENT_PASSWORD", "Current password is incorrect");
        }
        if (r.newPassword().equals(r.currentPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED", "The new password must be different",
                Map.of("newPassword", "must be different from the current password"));
        }
        u.setPasswordHash(encoder.encode(checkPassword("newPassword", r.newPassword(), u.getUsername())));
        u.setMustChangePassword(false);
        u.setTokenVersion(u.getTokenVersion() + 1);
        limiter.recordPasswordChangeSuccess(me.id());
        audit.record(me, u, "PASSWORD_CHANGED", null, null, ip);
        events.publishEvent(new SessionsRevoked(u.getId(), null));
    }

    /** All users, or only those with {@code status} (ACTIVE or DISABLED); anything else is a 400. */
    @Transactional(readOnly = true)
    public List<UserView> list(String status) {
        if (status != null && !status.isBlank() && !status.equals("ACTIVE") && !status.equals("DISABLED")) {
            throw ApiException.badRequest("INVALID_STATUS", "status must be ACTIVE or DISABLED");
        }
        boolean all = status == null || status.isBlank();
        return users.findAllByOrderByUsernameAsc().stream().filter(u -> all || status.equals(u.getStatus()))
            .map(u -> UserView.of(u, limiter.isLocked(u.getUsername()))).toList();
    }

    @Transactional
    public UserView create(UserPrincipal actor, CreateUserRequest r, String ip) {
        if (users.findByUsernameIgnoreCase(r.username()).isPresent()) {
            throw ApiException.conflict("USERNAME_EXISTS", "Username already exists");
        }
        User u = new User();
        u.setUsername(r.username());
        u.setPasswordHash(encoder.encode(checkPassword("password", r.password(), r.username())));
        u.setRole(r.role());
        u.setMustChangePassword(Boolean.TRUE.equals(r.mustChangePassword()));
        u = users.saveAndFlush(u);
        audit.record(actor, u, "USER_CREATED", null, u.getRole(), ip);
        return UserView.of(u);
    }

    @Transactional
    public UserView update(UserPrincipal actor, UUID id, UpdateUserRequest r, String ip) {
        User u = require(id);
        boolean demotesSelf = id.equals(actor.id()) && (("VIEWER".equals(r.role())) || "DISABLED".equals(r.status()));
        if (demotesSelf) throw ApiException.badRequest("SELF_LOCKOUT", "You cannot demote or disable your own account");
        if (r.role() != null && !r.role().equals(u.getRole())) {
            audit.record(actor, u, "ROLE_CHANGED", u.getRole(), r.role(), ip);
            u.setRole(r.role());
        }
        if (r.status() != null && !r.status().equals(u.getStatus())) {
            audit.record(actor, u, "STATUS_CHANGED", u.getStatus(), r.status(), ip);
            u.setStatus(r.status());
            u.setTokenVersion(u.getTokenVersion() + 1);
            events.publishEvent(new SessionsRevoked(u.getId(), null));
        }
        return UserView.of(users.saveAndFlush(u), limiter.isLocked(u.getUsername()));
    }

    @Transactional
    public void resetPassword(UserPrincipal actor, UUID id, ResetPasswordRequest r, String ip) {
        User u = require(id);
        u.setPasswordHash(encoder.encode(checkPassword("newPassword", r.newPassword(), u.getUsername())));
        u.setMustChangePassword(Boolean.TRUE.equals(r.mustChangePassword()));
        u.setTokenVersion(u.getTokenVersion() + 1);
        audit.record(actor, u, "PASSWORD_RESET", null, u.isMustChangePassword() ? "MUST_CHANGE" : null, ip);
        events.publishEvent(new SessionsRevoked(u.getId(), null));
    }

    /** Admin action: forget the failed-login lockout of a user on every client IP. */
    @Transactional
    public void unlock(UserPrincipal actor, UUID id, String ip) {
        User u = require(id);
        limiter.unlock(u.getUsername());
        audit.record(actor, u, "LOGIN_UNLOCKED", null, null, ip);
    }

    /** bcrypt only reads 72 bytes and rejects longer input; @Size counts characters, not bytes. */
    static boolean tooLongForBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > 72;
    }

    private static String checkPassword(String field, String password, String username) {
        if (tooLongForBcrypt(password)) {
            String message = "must be at most 72 bytes (accented letters count as 2-3 bytes)";
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Password is too long", Map.of(field, message));
        }
        String problem = PasswordPolicy.problem(password, username);
        if (problem != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "Password is too easy to guess",
                Map.of(field, problem));
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

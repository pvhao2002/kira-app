package com.kira.bank.identity.application;

import com.kira.bank.identity.domain.RefreshToken;
import com.kira.bank.identity.domain.Role;
import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.RefreshTokenRepository;
import com.kira.bank.identity.infrastructure.RoleRepository;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

import static com.kira.bank.identity.application.AuthDtos.*;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginRateLimiter loginLimiter;
    @Value("${app.jwt.refresh-ttl}")
    private Duration refreshTtl;
    private volatile String dummyPasswordHash;

    @Transactional
    public Session register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email))
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email đã được sử dụng");
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(request.password()));
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone());
        user.getRoles().add(roles.findByName("ROLE_USER").orElseThrow());
        users.save(user);
        return newSession(user, UUID.randomUUID().toString());
    }

    @Transactional
    public ProfileResponse createUser(CreateUserRequest request) {
        if (request.roles() != null && request.roles().stream().anyMatch(role -> !"ROLE_USER".equals(role)))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_USER_ROLES", "Chỉ được tạo tài khoản User");
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email))
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email đã được sử dụng");
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(request.password()));
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone());
        user.getRoles().add(roles.findByName("ROLE_USER").orElseThrow());
        user.setStatus("ACTIVE");
        try {
            users.saveAndFlush(user);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            if (ex.getMostSpecificCause() instanceof java.sql.SQLException sql && sql.getErrorCode() == 1062)
                throw new ApiException(HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email đã được sử dụng");
            throw ex;
        }
        return profile(user);
    }

    @Transactional(readOnly = true)
    public com.kira.bank.shared.web.ApiTypes.PageResponse<AdminUserResponse> listUsers(String search, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION", "Phân trang không hợp lệ");
        var result = users.searchActiveRecords(search.trim(), org.springframework.data.domain.PageRequest.of(page, size,
            org.springframework.data.domain.Sort.by("createdAt").descending().and(
                org.springframework.data.domain.Sort.by("id").descending())));
        var data = result.getContent().stream().map(user -> new AdminUserResponse(user.getId(), user.getEmail(),
            user.getFullName(), user.getPhone(), user.getRoles().stream().map(Role::getName)
            .collect(java.util.stream.Collectors.toSet()), user.getStatus())).toList();
        return new com.kira.bank.shared.web.ApiTypes.PageResponse<>(data,
            new com.kira.bank.shared.web.ApiTypes.PageMeta(page, size, result.getTotalElements(), result.getTotalPages()));
    }

    @Transactional
    public Session login(LoginRequest request, String clientIp) {
        loginLimiter.acquire(clientIp, request.email());
        User user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(request.email()).orElse(null);
        if (user == null) {
            // Spend the same bcrypt cost as a real check so response time does not reveal which emails exist.
            encoder.matches(request.password(), dummyPasswordHash());
        }
        if (user == null || !"ACTIVE".equals(user.getStatus())
            || !encoder.matches(request.password(), user.getPasswordHash())) {
            loginLimiter.recordFailure(request.email());
            throw badCredentials();
        }
        loginLimiter.recordSuccess(request.email());
        return newSession(user, UUID.randomUUID().toString());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Session rotate(String raw) {
        RefreshToken old = tokens.findByTokenHash(hash(raw)).orElseThrow(this::invalidRefresh);
        if (old.getRevokedAt() != null || old.getExpiresAt().isBefore(Instant.now())) {
            tokens.findByFamilyIdAndRevokedAtIsNull(old.getFamilyId()).forEach(t -> t.setRevokedAt(Instant.now()));
            throw invalidRefresh();
        }
        if (!"ACTIVE".equals(old.getUser().getStatus()) || old.getUser().getDeletedAt() != null) {
            old.setRevokedAt(Instant.now());
            throw invalidRefresh();
        }
        old.setRevokedAt(Instant.now());
        Session session = newSession(old.getUser(), old.getFamilyId());
        old.setReplacedByHash(hash(session.refreshToken()));
        return session;
    }

    @Transactional
    public void logout(String raw) {
        if (raw != null) tokens.findByTokenHash(hash(raw)).ifPresent(t -> t.setRevokedAt(Instant.now()));
    }

    @Transactional
    public void changePassword(Long id, ChangePasswordRequest request) {
        User user = require(id);
        if (!encoder.matches(request.currentPassword(), user.getPasswordHash())) throw badCredentials();
        user.setPasswordHash(encoder.encode(request.newPassword()));
    }

    @Transactional
    public ProfileResponse update(Long id, UpdateProfileRequest request) {
        User user = requireForUpdate(id);
        if (user.getVersion() != request.version()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROFILE_VERSION_CONFLICT",
                "Hồ sơ đã được cập nhật ở phiên khác");
        }
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone());
        return profile(users.saveAndFlush(user));
    }

    @Transactional(readOnly = true)
    public ProfileResponse profile(Long id) {
        return profile(require(id));
    }

    private Session newSession(User user, String family) {
        String raw = UUID.randomUUID() + "." + UUID.randomUUID();
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(hash(raw));
        token.setFamilyId(family);
        token.setExpiresAt(Instant.now().plus(refreshTtl));
        tokens.save(token);
        return new Session(new AuthResponse(jwt.issue(user), jwt.expiresInSeconds(), profile(user)), raw);
    }

    private ProfileResponse profile(User u) {
        return new ProfileResponse(u.getId(), u.getEmail(), u.getFullName(), u.getPhone(),
            u.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toSet()), u.getVersion());
    }

    private User require(Long id) {
        return users.findById(id).filter(u -> u.getDeletedAt() == null).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }

    private User requireForUpdate(Long id) {
        return users.findByIdForUpdate(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
            "USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }

    private String dummyPasswordHash() {
        String hash = dummyPasswordHash;
        if (hash == null) {
            hash = encoder.encode(UUID.randomUUID().toString());
            dummyPasswordHash = hash;
        }
        return hash;
    }

    private ApiException badCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Email hoặc mật khẩu không đúng");
    }

    private ApiException invalidRefresh() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public record Session(AuthResponse response, String refreshToken) {
    }
}


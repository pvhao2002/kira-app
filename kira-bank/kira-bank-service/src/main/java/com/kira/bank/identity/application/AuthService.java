package com.kira.bank.identity.application;

import com.kira.bank.identity.domain.*;
import com.kira.bank.identity.infrastructure.*;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import java.util.HexFormat;

import static com.kira.bank.identity.application.AuthDtos.*;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    @Value("${app.jwt.refresh-ttl}")
    private Duration refreshTtl;

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
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email))
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email đã được sử dụng");
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(request.password()));
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone());
        user.getRoles().add(roles.findByName("ROLE_USER").orElseThrow());
        if (request.roles() != null && request.roles().contains("ROLE_ADMIN"))
            user.getRoles().add(roles.findByName("ROLE_ADMIN").orElseThrow());
        users.save(user);
        return profile(user);
    }

    @Transactional
    public Session login(LoginRequest request) {
        User user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(request.email()).orElseThrow(this::badCredentials);
        if (!"ACTIVE".equals(user.getStatus()) || !encoder.matches(request.password(), user.getPasswordHash()))
            throw badCredentials();
        return newSession(user, UUID.randomUUID().toString());
    }

    @Transactional
    public Session rotate(String raw) {
        RefreshToken old = tokens.findByTokenHash(hash(raw)).orElseThrow(this::invalidRefresh);
        if (old.getRevokedAt() != null || old.getExpiresAt().isBefore(Instant.now())) {
            tokens.findByFamilyIdAndRevokedAtIsNull(old.getFamilyId()).forEach(t -> t.setRevokedAt(Instant.now()));
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
        User user = require(id);
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone());
        return profile(user);
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
        return new ProfileResponse(u.getId(), u.getEmail(), u.getFullName(), u.getPhone(), u.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toSet()));
    }

    private User require(Long id) {
        return users.findById(id).filter(u -> u.getDeletedAt() == null).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng"));
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


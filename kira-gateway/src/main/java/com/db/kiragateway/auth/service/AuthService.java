package com.db.kiragateway.auth.service;

import com.db.kiragateway.auth.model.AuthenticatedUser;
import com.db.kiragateway.auth.model.UserCredential;
import com.db.kiragateway.auth.repository.UserAuthRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Optional;

@Service
public class AuthService {

    private final UserAuthRepository userAuthRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserAuthRepository userAuthRepository, PasswordEncoder passwordEncoder) {
        this.userAuthRepository = userAuthRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public Optional<AuthenticatedUser> authenticate(String username, String rawPassword) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(rawPassword)) {
            return Optional.empty();
        }

        var normalizedUsername = username.trim();
        return userAuthRepository.findByUsername(normalizedUsername)
                .filter(this::isActive)
                .filter(user -> passwordMatches(rawPassword, user.passwordHash()))
                .map(user -> new AuthenticatedUser(
                        user.userId(),
                        user.username(),
                        normalizeRole(user.role()),
                        normalizeAvatar(user.avatar())
                ));
    }

    public AuthenticatedUser registerInternal(String username, String rawPassword, String role) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(rawPassword)) {
            throw new IllegalArgumentException("username and password are required");
        }

        var normalizedUsername = username.trim();
        if (userAuthRepository.findByUsername(normalizedUsername).isPresent()) {
            throw new IllegalStateException("Username already exists");
        }

        var normalizedRole = normalizeRole(role);
        var encodedPassword = passwordEncoder.encode(rawPassword);
        userAuthRepository.insertUser(normalizedUsername, encodedPassword, "active", normalizedRole, null);

        return userAuthRepository.findByUsername(normalizedUsername)
                .map(this::toAuthenticatedUser)
                .orElseThrow(() -> new IllegalStateException("Could not create user"));
    }

    public Optional<AuthenticatedUser> findByUserId(int userId) {
        if (userId <= 0) {
            return Optional.empty();
        }
        return userAuthRepository.findByUserId(userId).map(this::toAuthenticatedUser);
    }

    public Optional<AuthenticatedUser> findByUsername(String username) {
        if (!StringUtils.hasText(username)) {
            return Optional.empty();
        }
        return userAuthRepository.findByUsername(username.trim()).map(this::toAuthenticatedUser);
    }

    /**
     * Sets a new password for an existing user (no old password or token). Intended for trusted internal
     * use only; do not expose to the public internet without additional protection.
     */
    public boolean resetPasswordByUsername(String username, String newPassword) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(newPassword)) {
            return false;
        }
        var normalizedUsername = username.trim();
        if (userAuthRepository.findByUsername(normalizedUsername).isEmpty()) {
            return false;
        }
        var encoded = passwordEncoder.encode(newPassword);
        return userAuthRepository.updatePasswordByUsername(normalizedUsername, encoded) > 0;
    }

    private boolean isActive(UserCredential user) {
        var status = user.status();
        if (!StringUtils.hasText(status)) {
            return false;
        }
        return "active".equalsIgnoreCase(status.trim()) || "enabled".equalsIgnoreCase(status.trim());
    }

    private boolean passwordMatches(String rawPassword, String hash) {
        if (!StringUtils.hasText(hash)) {
            return false;
        }
        try {
            return passwordEncoder.matches(rawPassword, hash);
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private String normalizeRole(String role) {
        if (!StringUtils.hasText(role)) {
            return "user";
        }
        return role.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeAvatar(String avatar) {
        if (!StringUtils.hasText(avatar)) {
            return null;
        }
        return avatar.trim();
    }

    private AuthenticatedUser toAuthenticatedUser(UserCredential user) {
        return new AuthenticatedUser(
                user.userId(),
                user.username(),
                normalizeRole(user.role()),
                normalizeAvatar(user.avatar())
        );
    }
}

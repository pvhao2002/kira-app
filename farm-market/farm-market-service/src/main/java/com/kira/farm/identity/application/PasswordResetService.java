package com.kira.farm.identity.application;

import com.kira.farm.identity.domain.PasswordResetToken;
import com.kira.farm.identity.domain.User;
import com.kira.farm.identity.domain.UserStatus;
import com.kira.farm.identity.infrastructure.PasswordResetTokenRepository;
import com.kira.farm.identity.infrastructure.RefreshTokenRepository;
import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.shared.security.Hashing;
import com.kira.farm.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * Forgot / reset password. forgot() answers the same way for known and unknown emails; the link is sent only after the
 * token row is committed. reset() redeems a token exactly once and revokes every refresh token of the user.
 * ponytail debts:
 * - timing oracle: the known-email path (insert + notifier call in afterCommit, an SMTP round trip once real mail
 *   exists) is slower than the unknown-email path; when a real notifier is added, send it async (@Async or a
 *   virtual-thread executor) so both paths return at the same speed.
 * - the forgot limit is per email only (per instance), so anyone can lock a victim out of recovery for 15 minutes;
 *   add a per-IP window if that matters. The 429 stays.
 * - used/expired token rows are never purged (small volume); add a scheduled purge of expires_at < now - 1 day.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final PasswordResetNotifier notifier;
    private final LoginRateLimiter limiter;
    @Value("${app.password-reset.ttl}")
    private Duration ttl;
    @Value("${app.public-url}")
    private String publicUrl;

    @Transactional
    public void forgot(String rawEmail) {
        String email = rawEmail.trim(); // limiter lowercases its own key; the lookup is case-insensitive
        limiter.checkForgot(email);
        User user = users.findByEmailIgnoreCase(email).filter(u -> u.getStatus() == UserStatus.ACTIVE).orElse(null);
        if (user == null) return;
        tokens.deleteByUserId(user.getId());
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        PasswordResetToken t = new PasswordResetToken();
        t.setUserId(user.getId());
        t.setTokenHash(Hashing.sha256Hex(raw));
        t.setExpiresAt(Instant.now().plus(ttl));
        tokens.save(t);
        String base = publicUrl;
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        String link = base + "/reset-password#token=" + raw;
        String to = user.getEmail();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    notifier.sendResetLink(to, link);
                } catch (RuntimeException e) {
                    log.warn("Password reset notification failed: {}", e.getClass().getSimpleName());
                }
            }
        });
    }

    @Transactional
    public void reset(String rawToken, String newPassword) {
        Instant now = Instant.now();
        PasswordResetToken t = tokens.findByTokenHash(Hashing.sha256Hex(rawToken.trim())).orElseThrow(this::invalid);
        Long tokenId = t.getId();
        Long userId = t.getUserId();
        if (tokens.markUsed(tokenId, now) == 0) throw invalid(); // WHERE clause enforces unused + unexpired
        User user = users.findById(userId).filter(u -> u.getStatus() == UserStatus.ACTIVE).orElseThrow(this::invalid);
        user.setPasswordHash(encoder.encode(newPassword));
        users.saveAndFlush(user);
        refreshTokens.revokeAllByUser(userId, now);
        limiter.recordSuccess(user.getEmail()); // a lockout from wrong passwords must not outlive a successful reset
    }

    private ApiException invalid() {
        return ApiException.badRequest("RESET_TOKEN_INVALID", "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    }
}

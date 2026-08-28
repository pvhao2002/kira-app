package com.kira.bank.passwordvault.application;

import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.passwordvault.domain.PasswordVaultAccount;
import com.kira.bank.passwordvault.domain.PasswordVaultModule;
import com.kira.bank.passwordvault.domain.PasswordVaultUnlockSession;
import com.kira.bank.passwordvault.infrastructure.*;
import com.kira.bank.passwordvault.infrastructure.PasswordVaultAuditRepository.AuditContext;
import com.kira.bank.passwordvault.infrastructure.PasswordVaultCipher.EncryptedSecret;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static com.kira.bank.passwordvault.application.PasswordVaultDtos.*;

@Service
@RequiredArgsConstructor
public class PasswordVaultService {
    private static final Duration UNLOCK_TTL = Duration.ofMinutes(5);
    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
    private static final int MAX_FAILURES = 5;
    private static final String MASK = "••••••••";

    private final PasswordVaultModuleRepository modules;
    private final PasswordVaultAccountRepository accounts;
    private final PasswordVaultUnlockSessionRepository unlockSessions;
    private final PasswordVaultAuditRepository audit;
    private final PasswordVaultCipher cipher;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    @Transactional(readOnly = true)
    public List<ModuleResponse> modules(Long userId, String search) {
        String normalized = normalized(search);
        return modules.findByOwnerIdAndDeletedAtIsNullOrderByNameAscIdAsc(userId).stream()
            .filter(module -> normalized.isBlank() || contains(module.getName(), normalized)
                || contains(module.getWebsiteUrl(), normalized))
            .map(module -> moduleResponse(userId, module)).toList();
    }

    @Transactional
    public ModuleResponse createModule(Long userId, ModuleRequest request, AuditContext context) {
        if (request.version() != null) throw bad("VAULT_VERSION_NOT_ALLOWED", "Version không được gửi khi tạo module");
        PasswordVaultModule module = new PasswordVaultModule();
        module.setOwnerId(userId);
        module.setName(request.name().trim());
        module.setWebsiteUrl(blankToNull(request.websiteUrl()));
        module.setDescription(blankToNull(request.description()));
        module.setCreatedBy(userId);
        module.setUpdatedBy(userId);
        module = modules.saveAndFlush(module);
        audit.record(userId, "PASSWORD_VAULT_CREATE", "PASSWORD_VAULT_MODULE", module.getId(), Map.of(), context);
        return moduleResponse(userId, module);
    }

    @Transactional
    public ModuleResponse updateModule(Long userId, Long id, ModuleRequest request, AuditContext context) {
        PasswordVaultModule module = module(userId, id);
        requireVersion(module.getVersion(), request.version());
        module.setName(request.name().trim());
        module.setWebsiteUrl(blankToNull(request.websiteUrl()));
        module.setDescription(blankToNull(request.description()));
        module.setUpdatedBy(userId);
        module = modules.saveAndFlush(module);
        audit.record(userId, "PASSWORD_VAULT_UPDATE", "PASSWORD_VAULT_MODULE", id, Map.of(), context);
        return moduleResponse(userId, module);
    }

    @Transactional
    public void deleteModule(Long userId, Long id, VersionRequest request, AuditContext context) {
        PasswordVaultModule module = module(userId, id);
        requireVersion(module.getVersion(), request.version());
        Instant now = Instant.now();
        int deletedAccounts = accounts.softDeleteModuleAccounts(userId, id, now);
        module.setDeletedAt(now);
        module.setUpdatedBy(userId);
        modules.saveAndFlush(module);
        audit.record(userId, "PASSWORD_VAULT_DELETE", "PASSWORD_VAULT_MODULE", id,
            Map.of("deletedAccountCount", deletedAccounts), context);
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> accounts(Long userId, Long moduleId, String search) {
        module(userId, moduleId);
        String normalized = normalized(search);
        return accounts.findByOwnerIdAndModuleIdAndDeletedAtIsNullOrderByDisplayNameAscIdAsc(userId, moduleId).stream()
            .filter(account -> normalized.isBlank() || contains(account.getDisplayName(), normalized))
            .map(this::accountResponse).toList();
    }

    @Transactional
    public AccountResponse createAccount(Long userId, Long moduleId, AccountRequest request, AuditContext context) {
        if (request.version() != null) throw bad("VAULT_VERSION_NOT_ALLOWED", "Version không được gửi khi tạo account");
        module(userId, moduleId);
        PasswordVaultAccount account = new PasswordVaultAccount();
        account.setOwnerId(userId);
        account.setModuleId(moduleId);
        account.setAccountUuid(UUID.randomUUID().toString());
        account.setDisplayName(request.displayName().trim());
        applyEncrypted(account, cipher.encrypt(userId, moduleId, account.getAccountUuid(), secret(request)));
        account.setCreatedBy(userId);
        account.setUpdatedBy(userId);
        account = accounts.saveAndFlush(account);
        audit.record(userId, "PASSWORD_VAULT_CREATE", "PASSWORD_VAULT_ACCOUNT", account.getId(),
            Map.of("moduleId", moduleId), context);
        return accountResponse(account);
    }

    @Transactional
    public AccountResponse updateAccount(Long userId, Long id, String rawToken, AccountRequest request, AuditContext context) {
        requireUnlocked(userId, rawToken);
        PasswordVaultAccount account = account(userId, id);
        requireVersion(account.getVersion(), request.version());
        module(userId, account.getModuleId());
        account.setDisplayName(request.displayName().trim());
        applyEncrypted(account, cipher.encrypt(userId, account.getModuleId(), account.getAccountUuid(), secret(request)));
        account.setUpdatedBy(userId);
        account = accounts.saveAndFlush(account);
        audit.record(userId, "PASSWORD_VAULT_UPDATE", "PASSWORD_VAULT_ACCOUNT", id,
            Map.of("moduleId", account.getModuleId()), context);
        return accountResponse(account);
    }

    @Transactional
    public void deleteAccount(Long userId, Long id, VersionRequest request, AuditContext context) {
        PasswordVaultAccount account = account(userId, id);
        requireVersion(account.getVersion(), request.version());
        account.setDeletedAt(Instant.now());
        account.setUpdatedBy(userId);
        accounts.saveAndFlush(account);
        audit.record(userId, "PASSWORD_VAULT_DELETE", "PASSWORD_VAULT_ACCOUNT", id,
            Map.of("moduleId", account.getModuleId()), context);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public UnlockResponse unlock(Long userId, UnlockRequest request, AuditContext context) {
        Instant now = Instant.now();
        long recentFailures = audit.failedUnlocksSince(userId, now.minus(FAILURE_WINDOW));
        if (recentFailures >= MAX_FAILURES) throw rateLimited();
        User user = users.findById(userId).filter(value -> value.getDeletedAt() == null)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy người dùng"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            audit.record(userId, "PASSWORD_VAULT_UNLOCK_FAILED", "PASSWORD_VAULT", null,
                Map.of("failedAttempts", recentFailures + 1), context);
            if (recentFailures + 1 >= MAX_FAILURES) throw rateLimited();
            throw new ApiException(HttpStatus.UNAUTHORIZED, "VAULT_BAD_CREDENTIALS", "Mật khẩu hiện tại không đúng");
        }
        unlockSessions.revokeForUser(userId, now);
        String rawToken = token();
        PasswordVaultUnlockSession session = new PasswordVaultUnlockSession();
        session.setUserId(userId);
        session.setTokenHash(hash(rawToken));
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(UNLOCK_TTL));
        unlockSessions.save(session);
        audit.record(userId, "PASSWORD_VAULT_UNLOCK_SUCCESS", "PASSWORD_VAULT", null,
            Map.of("expiresAt", session.getExpiresAt().toString()), context);
        return new UnlockResponse(rawToken, session.getExpiresAt());
    }

    @Transactional
    public void lock(Long userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        unlockSessions.findByTokenHashAndUserIdAndRevokedAtIsNull(hash(rawToken), userId).ifPresent(session -> {
            session.setRevokedAt(Instant.now());
            unlockSessions.save(session);
        });
    }

    @Transactional
    public SecretResponse secret(Long userId, Long accountId, String rawToken,
                                 SecretRequest request, AuditContext context) {
        requireUnlocked(userId, rawToken);
        PasswordVaultAccount account = account(userId, accountId);
        VaultSecret secret = cipher.decrypt(userId, account.getModuleId(), account.getAccountUuid(),
            account.getSecretCiphertext(), account.getSecretNonce(), account.getWrappedDekCiphertext(),
            account.getWrappedDekNonce(), account.getEncryptionKeyId(), account.getCryptoVersion());
        if (cipher.needsRotation(account.getEncryptionKeyId())) {
            applyEncrypted(account, cipher.encrypt(userId, account.getModuleId(), account.getAccountUuid(), secret));
            account.setUpdatedBy(userId);
            accounts.saveAndFlush(account);
        }
        if (request.action() == SecretAction.COPY) {
            if (request.field() == null) throw bad("VAULT_SECRET_FIELD_REQUIRED", "Cần chọn dữ liệu muốn copy");
            audit.record(userId, "PASSWORD_VAULT_COPY", "PASSWORD_VAULT_ACCOUNT", accountId,
                Map.of("field", request.field().name()), context);
            return new SecretResponse(null, null, null, null, field(secret, request.field()));
        }
        audit.record(userId, "PASSWORD_VAULT_REVEAL", "PASSWORD_VAULT_ACCOUNT", accountId, Map.of(), context);
        return new SecretResponse(secret.username(), secret.password(), secret.loginUrl(), secret.note(), null);
    }

    private void requireUnlocked(Long userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) throw locked();
        PasswordVaultUnlockSession session = unlockSessions
            .findByTokenHashAndUserIdAndRevokedAtIsNull(hash(rawToken), userId).orElseThrow(this::locked);
        if (!session.getExpiresAt().isAfter(Instant.now())) {
            session.setRevokedAt(Instant.now());
            unlockSessions.save(session);
            throw locked();
        }
    }

    private String field(VaultSecret secret, SecretField field) {
        return switch (field) {
            case USERNAME -> secret.username();
            case PASSWORD -> secret.password();
            case LOGIN_URL -> secret.loginUrl();
            case NOTE -> secret.note();
        };
    }

    private PasswordVaultModule module(Long userId, Long id) {
        return modules.findByIdAndOwnerIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "VAULT_MODULE_NOT_FOUND", "Không tìm thấy module"));
    }

    private PasswordVaultAccount account(Long userId, Long id) {
        return accounts.findByIdAndOwnerIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "VAULT_ACCOUNT_NOT_FOUND", "Không tìm thấy account"));
    }

    private ModuleResponse moduleResponse(Long userId, PasswordVaultModule module) {
        return new ModuleResponse(module.getId(), module.getName(), module.getWebsiteUrl(), module.getDescription(),
            accounts.countByOwnerIdAndModuleIdAndDeletedAtIsNull(userId, module.getId()), module.getVersion(),
            module.getCreatedAt(), module.getUpdatedAt());
    }

    private AccountResponse accountResponse(PasswordVaultAccount account) {
        return new AccountResponse(account.getId(), account.getModuleId(), account.getDisplayName(), MASK,
            account.getVersion(), account.getCreatedAt(), account.getUpdatedAt());
    }

    private VaultSecret secret(AccountRequest request) {
        return new VaultSecret(blankToNull(request.username()), request.password(),
            blankToNull(request.loginUrl()), blankToNull(request.note()));
    }

    private void applyEncrypted(PasswordVaultAccount account, EncryptedSecret encrypted) {
        account.setSecretCiphertext(encrypted.ciphertext());
        account.setSecretNonce(encrypted.secretNonce());
        account.setWrappedDekCiphertext(encrypted.wrappedDek());
        account.setWrappedDekNonce(encrypted.wrapNonce());
        account.setEncryptionKeyId(encrypted.keyId());
        account.setCryptoVersion(encrypted.cryptoVersion());
    }

    private void requireVersion(long actual, Long requested) {
        if (requested == null || actual != requested) {
            throw new ApiException(HttpStatus.CONFLICT, "VAULT_VERSION_CONFLICT",
                "Password vault đã được cập nhật ở phiên khác, vui lòng tải lại");
        }
    }

    private ApiException locked() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "VAULT_LOCKED", "Password vault đang khóa hoặc phiên mở khóa đã hết hạn");
    }

    private ApiException rateLimited() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.RETRY_AFTER, Long.toString(FAILURE_WINDOW.toSeconds()));
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "VAULT_UNLOCK_RATE_LIMITED",
            "Đã nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút", headers);
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private String normalized(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }
    private boolean contains(String value, String search) { return value != null && value.toLowerCase(Locale.ROOT).contains(search); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private String token() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}

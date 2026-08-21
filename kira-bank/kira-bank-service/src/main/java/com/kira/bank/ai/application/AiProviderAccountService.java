package com.kira.bank.ai.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.kira.bank.ai.domain.AiProviderAccount;
import com.kira.bank.ai.domain.AiProviderAccountStatus;
import com.kira.bank.ai.infrastructure.AiCredentialCipher;
import com.kira.bank.ai.infrastructure.AiProviderAccountRepository;
import com.kira.bank.attachment.CloudflareR2ClientFactory;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static com.kira.bank.ai.application.AiProviderAccountDtos.*;

@Service
@RequiredArgsConstructor
public class AiProviderAccountService {
    public static final String DEFAULT_MODEL = "@cf/moonshotai/kimi-k2.7-code";

    private final AiProviderAccountRepository repository;
    private final AttachmentRepository attachments;
    private final AiCredentialCipher cipher;
    private final RestClient cloudflareAiRestClient;
    private final CloudflareR2ClientFactory r2Clients;

    @Transactional(readOnly = true)
    public List<AccountResponse> list() {
        long legacy = attachments.countByR2AccountIdIsNullAndStoragePurgedAtIsNull();
        return repository.findByDeletedAtIsNullOrderByPriorityAscIdAsc().stream()
            .map(account -> response(account, legacy)).toList();
    }

    @Transactional
    public AccountResponse create(Long adminId, CreateRequest request) {
        requireCipher();
        String accountId = normalized(request.accountId());
        if (repository.existsByAccountIdAndDeletedAtIsNull(accountId)) throw duplicate();
        AiProviderAccount account = new AiProviderAccount();
        account.setDisplayName(request.displayName().trim());
        account.setAccountId(accountId);
        account.setApiTokenCiphertext(encryptOrPlaceholder(request.apiToken()));
        account.setAiModel(valueOrDefault(request.aiModel(), DEFAULT_MODEL));
        account.setPriority(request.priority());
        account.setEnabled(false);
        account.setHealthStatus(AiProviderAccountStatus.PENDING_TEST);
        account.setR2AccessKeyCiphertext(encryptNullable(request.r2AccessKeyId()));
        account.setR2SecretKeyCiphertext(encryptNullable(request.r2SecretAccessKey()));
        account.setR2BucketName(blankToNull(request.r2BucketName()));
        account.setR2PublicUrl(blankToNull(request.r2PublicUrl()));
        account.setR2Primary(false);
        account.setR2HealthStatus(AiProviderAccountStatus.PENDING_TEST);
        account.setCreatedBy(adminId);
        account.setUpdatedBy(adminId);
        try {
            return response(repository.saveAndFlush(account));
        } catch (DataIntegrityViolationException ex) {
            throw duplicate();
        }
    }

    @Transactional
    public AccountResponse update(Long adminId, Long id, UpdateRequest request) {
        requireCipher();
        AiProviderAccount account = account(id);
        assertVersion(account, request.version());
        long references = attachments.countByR2AccountId(id);
        boolean aiChanged = false;
        boolean r2Changed = false;
        if (!blank(request.accountId()) && !request.accountId().trim().equals(account.getAccountId())) {
            if (references > 0) throw conflict("CLOUDFLARE_ACCOUNT_IN_USE", "Không thể đổi Account ID đang chứa file R2");
            String accountId = normalized(request.accountId());
            if (repository.existsByAccountIdAndIdNotAndDeletedAtIsNull(accountId, id)) throw duplicate();
            account.setAccountId(accountId);
            aiChanged = true;
            r2Changed = true;
        }
        if (!blank(request.apiToken())) {
            account.setApiTokenCiphertext(cipher.encrypt(request.apiToken().trim()));
            aiChanged = true;
        }
        if (!blank(request.aiModel()) && !request.aiModel().trim().equals(account.getAiModel())) {
            account.setAiModel(request.aiModel().trim());
            aiChanged = true;
        }
        if (!blank(request.r2AccessKeyId())) {
            account.setR2AccessKeyCiphertext(cipher.encrypt(request.r2AccessKeyId().trim()));
            r2Changed = true;
        }
        if (!blank(request.r2SecretAccessKey())) {
            account.setR2SecretKeyCiphertext(cipher.encrypt(request.r2SecretAccessKey().trim()));
            r2Changed = true;
        }
        String bucket = blankToNull(request.r2BucketName());
        if (bucket != null && !bucket.equals(account.getR2BucketName())) {
            if (references > 0) throw conflict("R2_BUCKET_IN_USE", "Không thể đổi bucket đang chứa file");
            account.setR2BucketName(bucket);
            r2Changed = true;
        }
        if (request.r2PublicUrl() != null) account.setR2PublicUrl(blankToNull(request.r2PublicUrl()));
        account.setDisplayName(request.displayName().trim());
        account.setPriority(request.priority());
        account.setUpdatedBy(adminId);
        if (aiChanged) resetAi(account);
        if (r2Changed) resetR2(account);
        return response(persist(account));
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AccountResponse testAi(Long adminId, Long id, AiTestRequest request) {
        AiProviderAccount account = account(id);
        assertVersion(account, request.version());
        requireCipher();
        String token = !blank(request.apiToken()) ? request.apiToken().trim() : decryptRequired(account.getApiTokenCiphertext(), "AI_TOKEN_REQUIRED");
        String model = !blank(request.model()) ? request.model().trim() : valueOrDefault(account.getAiModel(), DEFAULT_MODEL);
        Instant now = Instant.now();
        try {
            JsonNode result = cloudflareAiRestClient.get()
                .uri(uri -> uri.path("/{accountId}/ai/models/search").queryParam("search", model).build(account.getAccountId()))
                .header("Authorization", "Bearer " + token).retrieve().body(JsonNode.class);
            if (result == null || (result.has("success") && !result.path("success").asBoolean())
                || !result.path("result").isArray() || result.path("result").isEmpty()) {
                throw new IllegalStateException("MODEL_NOT_AVAILABLE");
            }
            account.setApiTokenCiphertext(cipher.encrypt(token));
            account.setAiModel(model);
            account.setHealthStatus(AiProviderAccountStatus.VERIFIED);
            account.setCooldownUntil(null);
            account.setLastErrorCode(null);
            account.setLastErrorAt(null);
            account.setLastTestedAt(now);
            account.setUpdatedBy(adminId);
            return response(persist(account));
        } catch (RestClientResponseException ex) {
            markAiTestFailure(account, adminId, now, "HTTP_" + ex.getStatusCode().value());
            persist(account);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_ACCOUNT_TEST_FAILED", "Cloudflare từ chối AI credential hoặc model");
        } catch (ApiException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            markAiTestFailure(account, adminId, now, "AI_TEST_FAILED");
            persist(account);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_ACCOUNT_TEST_FAILED", "Không thể kiểm tra Workers AI");
        }
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AccountResponse testR2(Long adminId, Long id, R2TestRequest request) {
        AiProviderAccount account = account(id);
        assertVersion(account, request.version());
        requireCipher();
        String access = candidate(request.accessKeyId(), account.getR2AccessKeyCiphertext(), "R2_ACCESS_KEY_REQUIRED");
        String secret = candidate(request.secretAccessKey(), account.getR2SecretKeyCiphertext(), "R2_SECRET_KEY_REQUIRED");
        String bucket = !blank(request.bucketName()) ? request.bucketName().trim() : required(account.getR2BucketName(), "R2_BUCKET_REQUIRED");
        String publicUrl = request.publicUrl() == null ? account.getR2PublicUrl() : blankToNull(request.publicUrl());
        Instant now = Instant.now();
        String key = "_kira-health/" + UUID.randomUUID() + ".txt";
        byte[] probe = "kira-r2-health".getBytes(StandardCharsets.UTF_8);
        boolean uploaded = false;
        S3Client client = null;
        try {
            client = r2Clients.create(account.getAccountId(), access, secret);
            client.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType("text/plain").build(), RequestBody.fromBytes(probe));
            uploaded = true;
            byte[] read = client.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build(), ResponseTransformer.toBytes()).asByteArray();
            if (!Arrays.equals(probe, read)) throw new IllegalStateException("R2_PROBE_MISMATCH");
            client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
            uploaded = false;
            account.setR2AccessKeyCiphertext(cipher.encrypt(access));
            account.setR2SecretKeyCiphertext(cipher.encrypt(secret));
            account.setR2BucketName(bucket);
            account.setR2PublicUrl(publicUrl);
            account.setR2HealthStatus(AiProviderAccountStatus.VERIFIED);
            account.setR2LastErrorCode(null);
            account.setR2LastErrorAt(null);
            account.setR2LastTestedAt(now);
            account.setUpdatedBy(adminId);
            return response(persist(account));
        } catch (RuntimeException ex) {
            account.setR2Primary(false);
            account.setR2HealthStatus(AiProviderAccountStatus.BLOCKED);
            account.setR2LastErrorCode("R2_TEST_FAILED");
            account.setR2LastErrorAt(now);
            account.setR2LastTestedAt(now);
            account.setUpdatedBy(adminId);
            persist(account);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "R2_ACCOUNT_TEST_FAILED", "Không thể upload, đọc và xóa object kiểm tra trên R2");
        } finally {
            if (uploaded && client != null) {
                try { client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build()); }
                catch (RuntimeException ignored) { /* Keep the safe test failure above; never log credentials. */ }
            }
            if (client != null) client.close();
        }
    }

    @Transactional public AccountResponse enableAi(Long adminId, Long id, VersionRequest request) { return setAiEnabled(adminId, id, request, true); }
    @Transactional public AccountResponse disableAi(Long adminId, Long id, VersionRequest request) { return setAiEnabled(adminId, id, request, false); }

    @Transactional
    public AccountResponse makeR2Primary(Long adminId, Long id, VersionRequest request) {
        AiProviderAccount account = account(id);
        assertVersion(account, request.version());
        if (account.getR2HealthStatus() != AiProviderAccountStatus.VERIFIED) throw conflict("R2_ACCOUNT_NOT_VERIFIED", "Cần Test R2 thành công trước khi chọn primary");
        repository.clearR2Primary();
        account = account(id);
        account.setR2Primary(true);
        account.setUpdatedBy(adminId);
        return response(persist(account));
    }

    @Transactional
    public AccountResponse stopR2Uploads(Long adminId, Long id, VersionRequest request) {
        AiProviderAccount account = account(id);
        assertVersion(account, request.version());
        account.setR2Primary(false);
        account.setUpdatedBy(adminId);
        return response(persist(account));
    }

    @Transactional
    public AccountResponse adoptLegacyAttachments(Long adminId, Long id, VersionRequest request) {
        AiProviderAccount account = account(id);
        assertVersion(account, request.version());
        if (account.getR2HealthStatus() != AiProviderAccountStatus.VERIFIED) throw conflict("R2_ACCOUNT_NOT_VERIFIED", "Cần Test R2 thành công trước khi gán file cũ");
        attachments.adoptLegacyR2Attachments(id);
        account.setUpdatedBy(adminId);
        return response(persist(account));
    }

    @Transactional
    public void delete(Long adminId, Long id, VersionRequest request) {
        AiProviderAccount account = account(id);
        assertVersion(account, request.version());
        if (attachments.countByR2AccountId(id) > 0) throw conflict("CLOUDFLARE_ACCOUNT_IN_USE", "Không thể xóa account đang chứa file R2");
        account.setEnabled(false);
        account.setR2Primary(false);
        account.setDeletedAt(Instant.now());
        account.setUpdatedBy(adminId);
        persist(account);
    }

    @Transactional(readOnly = true)
    public List<RuntimeCredential> availableCredentials() {
        if (!cipher.isConfigured()) return List.of();
        Instant now = Instant.now();
        return repository.findByDeletedAtIsNullOrderByPriorityAscIdAsc().stream()
            .filter(AiProviderAccount::isEnabled)
            .filter(a -> a.getHealthStatus() == AiProviderAccountStatus.VERIFIED
                || (a.getHealthStatus() == AiProviderAccountStatus.COOLDOWN && a.getCooldownUntil() != null && !a.getCooldownUntil().isAfter(now)))
            .filter(a -> !blank(a.getApiTokenCiphertext()) && !blank(a.getAiModel()))
            .map(a -> new RuntimeCredential(a.getId(), a.getDisplayName(), a.getAccountId(), cipher.decrypt(a.getApiTokenCiphertext()), a.getAiModel()))
            .toList();
    }

    @Transactional(readOnly = true)
    public RuntimeR2Credential primaryR2Credential() {
        return repository.findFirstByR2PrimaryTrueAndDeletedAtIsNull().map(account -> runtimeR2(account, false))
            .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "R2_NOT_CONFIGURED", "Chưa có Cloudflare R2 primary đã được xác minh"));
    }

    @Transactional(readOnly = true)
    public RuntimeR2Credential r2Credential(Long id) {
        if (id == null) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "R2_LEGACY_PROVIDER_UNASSIGNED", "File cũ chưa được gán Cloudflare R2 account");
        return runtimeR2(account(id), true);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW) public void markSuccess(Long id) { repository.markSuccess(id, AiProviderAccountStatus.VERIFIED, Instant.now()); }
    @Transactional(propagation = Propagation.REQUIRES_NEW) public void markBlocked(Long id, String code) { repository.markFailure(id, AiProviderAccountStatus.BLOCKED, null, code, Instant.now()); }
    @Transactional(propagation = Propagation.REQUIRES_NEW) public void markCooldown(Long id, Instant until, String code) { repository.markFailure(id, AiProviderAccountStatus.COOLDOWN, until, code, Instant.now()); }
    @Transactional(propagation = Propagation.REQUIRES_NEW) public void markR2Success(Long id) { repository.markR2Success(id, Instant.now()); }

    private AccountResponse setAiEnabled(Long adminId, Long id, VersionRequest request, boolean enabled) {
        AiProviderAccount account = account(id);
        assertVersion(account, request.version());
        if (enabled && account.getHealthStatus() != AiProviderAccountStatus.VERIFIED) throw conflict("AI_ACCOUNT_NOT_VERIFIED", "Cần Test AI thành công trước khi kích hoạt");
        account.setEnabled(enabled);
        account.setUpdatedBy(adminId);
        return response(persist(account));
    }

    private RuntimeR2Credential runtimeR2(AiProviderAccount account, boolean historicalRead) {
        requireCipher();
        if ((!historicalRead && account.getR2HealthStatus() != AiProviderAccountStatus.VERIFIED) || blank(account.getR2AccessKeyCiphertext())
            || blank(account.getR2SecretKeyCiphertext()) || blank(account.getR2BucketName())) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "R2_ACCOUNT_UNAVAILABLE", "Cloudflare R2 account chưa được xác minh");
        }
        return new RuntimeR2Credential(account.getId(), account.getVersion(), account.getAccountId(),
            cipher.decrypt(account.getR2AccessKeyCiphertext()), cipher.decrypt(account.getR2SecretKeyCiphertext()),
            account.getR2BucketName(), account.getR2PublicUrl());
    }

    private AccountResponse response(AiProviderAccount account) { return response(account, attachments.countByR2AccountIdIsNullAndStoragePurgedAtIsNull()); }
    private AccountResponse response(AiProviderAccount account, long legacy) {
        AiCapabilityResponse ai = new AiCapabilityResponse(!placeholder(account.getApiTokenCiphertext()), account.getAiModel(), account.getPriority(), account.isEnabled(),
            account.getHealthStatus(), account.getCooldownUntil(), account.getLastErrorCode(), account.getLastErrorAt(), account.getLastTestedAt(), account.getLastSuccessAt());
        R2CapabilityResponse r2 = new R2CapabilityResponse(!blank(account.getR2AccessKeyCiphertext()), !blank(account.getR2SecretKeyCiphertext()),
            maskedNullable(account.getR2BucketName()), maskedUrl(account.getR2PublicUrl()), account.isR2Primary(), account.getR2HealthStatus(),
            account.getR2LastErrorCode(), account.getR2LastErrorAt(), account.getR2LastTestedAt(), account.getR2LastSuccessAt(), attachments.countByR2AccountId(account.getId()));
        return new AccountResponse(account.getId(), account.getDisplayName(), masked(account.getAccountId()), ai, r2, legacy, account.getVersion());
    }

    private void resetAi(AiProviderAccount a) { a.setEnabled(false); a.setHealthStatus(AiProviderAccountStatus.PENDING_TEST); a.setCooldownUntil(null); a.setLastErrorCode(null); a.setLastErrorAt(null); }
    private void resetR2(AiProviderAccount a) { a.setR2Primary(false); a.setR2HealthStatus(AiProviderAccountStatus.PENDING_TEST); a.setR2LastErrorCode(null); a.setR2LastErrorAt(null); }
    private void markAiTestFailure(AiProviderAccount a, Long adminId, Instant now, String code) { a.setEnabled(false); a.setHealthStatus(AiProviderAccountStatus.BLOCKED); a.setCooldownUntil(null); a.setLastErrorCode(code); a.setLastErrorAt(now); a.setLastTestedAt(now); a.setUpdatedBy(adminId); }
    private AiProviderAccount account(Long id) { return repository.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLOUDFLARE_ACCOUNT_NOT_FOUND", "Không tìm thấy Cloudflare account")); }
    private void assertVersion(AiProviderAccount a, Long version) { if (version == null || a.getVersion() != version) throw conflict("CLOUDFLARE_ACCOUNT_VERSION_CONFLICT", "Cloudflare account đã được cập nhật, vui lòng tải lại"); }
    private AiProviderAccount persist(AiProviderAccount a) { try { return repository.saveAndFlush(a); } catch (ObjectOptimisticLockingFailureException ex) { throw conflict("CLOUDFLARE_ACCOUNT_VERSION_CONFLICT", "Cloudflare account đã được cập nhật, vui lòng tải lại"); } }
    private void requireCipher() { if (!cipher.isConfigured()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "CLOUDFLARE_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED", "Khóa mã hóa Cloudflare credential chưa được cấu hình"); }
    private String candidate(String value, String encrypted, String code) { return !blank(value) ? value.trim() : decryptRequired(encrypted, code); }
    private String decryptRequired(String encrypted, String code) { if (blank(encrypted) || placeholder(encrypted)) throw new ApiException(HttpStatus.BAD_REQUEST, code, "Thiếu Cloudflare credential"); return cipher.decrypt(encrypted); }
    private String required(String value, String code) { if (blank(value)) throw new ApiException(HttpStatus.BAD_REQUEST, code, "Thiếu cấu hình Cloudflare"); return value; }
    private String encryptOrPlaceholder(String value) { return blank(value) ? "UNCONFIGURED" : cipher.encrypt(value.trim()); }
    private String encryptNullable(String value) { return blank(value) ? null : cipher.encrypt(value.trim()); }
    private boolean placeholder(String value) { return "UNCONFIGURED".equals(value); }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private String blankToNull(String value) { return blank(value) ? null : value.trim(); }
    private String valueOrDefault(String value, String fallback) { return blank(value) ? fallback : value.trim(); }
    private String normalized(String value) { return value.trim(); }
    private String masked(String value) { return value.length() <= 8 ? "****" : value.substring(0, 4) + "••••" + value.substring(value.length() - 4); }
    private String maskedNullable(String value) { if (blank(value)) return null; return value.length() <= 6 ? "••••" : value.substring(0, 3) + "••••" + value.substring(value.length() - 3); }
    private String maskedUrl(String value) { if (blank(value)) return null; try { java.net.URI uri = java.net.URI.create(value); return uri.getScheme() + "://" + uri.getHost(); } catch (RuntimeException ex) { return "••••"; } }
    private ApiException duplicate() { return conflict("CLOUDFLARE_ACCOUNT_ID_EXISTS", "Cloudflare Account ID đã tồn tại"); }
    private ApiException conflict(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }

    public record RuntimeCredential(Long id, String displayName, String accountId, String apiToken, String model) {}
    public record RuntimeR2Credential(Long id, long version, String accountId, String accessKeyId, String secretAccessKey, String bucketName, String publicUrl) {}
}

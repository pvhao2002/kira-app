package com.kira.affiliate.shopee.application;

import com.kira.affiliate.shared.web.ApiException;
import com.kira.affiliate.shopee.domain.ShopeeCredential;
import com.kira.affiliate.shopee.infrastructure.CredentialCipher;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient.Credentials;
import com.kira.affiliate.shopee.infrastructure.ShopeeApiException;
import com.kira.affiliate.shopee.infrastructure.ShopeeCredentialRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ShopeeCredentialService {
    private final ShopeeCredentialRepository repository;
    private final CredentialCipher cipher;
    private final ShopeeAffiliateClient client;

    public record SaveRequest(@NotBlank @Pattern(regexp = "\\d{5,20}", message = "AppID chỉ gồm chữ số") String appId,
                              @NotBlank @Pattern(regexp = "\\S{8,128}", message = "Secret không hợp lệ") String secret) {
        @Override
        public String toString() {
            return "SaveRequest[appId=" + appId + "]";
        }
    }

    /** The secret is deliberately absent. */
    public record Status(boolean configured, String appId, Instant lastCheckedAt, String lastStatus,
                         Integer lastErrorCode, String lastErrorMessage) {
    }

    @Transactional(readOnly = true)
    public Status status(Long userId) {
        return repository.findByUserId(userId).map(ShopeeCredentialService::status)
            .orElse(new Status(false, null, null, null, null, null));
    }

    @Transactional
    public void save(Long userId, SaveRequest request) {
        if (!cipher.isConfigured())
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "CREDENTIAL_STORE_NOT_CONFIGURED",
                "Máy chủ chưa cấu hình khóa mã hóa để lưu thông tin Shopee API");
        Instant now = Instant.now();
        ShopeeCredential credential = repository.findByUserId(userId).orElseGet(() -> {
            ShopeeCredential created = new ShopeeCredential();
            created.setUserId(userId);
            created.setCreatedAt(now);
            return created;
        });
        credential.setAppId(request.appId());
        credential.setSecretEnc(cipher.encrypt(request.secret()));
        credential.setUpdatedAt(now);
        credential.setLastCheckedAt(null);
        credential.setLastStatus(null);
        credential.setLastErrorCode(null);
        credential.setLastErrorMessage(null);
        repository.save(credential);
    }

    /** Calls Shopee outside any transaction, then records the outcome. */
    public Status test(Long userId) {
        Credentials credentials = require(userId);
        try {
            client.ping(credentials);
            recordResult(userId, null);
        } catch (ShopeeApiException ex) {
            recordResult(userId, ex);
        }
        return status(userId);
    }

    @Transactional
    public void delete(Long userId) {
        repository.deleteByUserId(userId);
    }

    @Transactional(readOnly = true)
    public Credentials require(Long userId) {
        ShopeeCredential credential = repository.findByUserId(userId).orElseThrow(() ->
            new ApiException(HttpStatus.CONFLICT, "SHOPEE_NOT_CONNECTED", "Chưa cấu hình Shopee API trong Cài đặt"));
        return new Credentials(credential.getAppId(), cipher.decrypt(credential.getSecretEnc()));
    }

    @Transactional(readOnly = true)
    public List<Long> connectedUserIds() {
        return repository.findUserIds();
    }

    @Transactional
    public void recordResult(Long userId, ShopeeApiException failure) {
        repository.findByUserId(userId).ifPresent(credential -> {
            credential.setLastCheckedAt(Instant.now());
            credential.setLastStatus(failure == null ? "OK" : failure.getKind().name());
            credential.setLastErrorCode(failure == null ? null : failure.getCode());
            credential.setLastErrorMessage(failure == null ? null : failure.userMessage());
            // Explicit save: test() calls this through `this`, where @Transactional (and dirty checking) does not apply.
            repository.save(credential);
        });
    }

    private static Status status(ShopeeCredential c) {
        return new Status(true, c.getAppId(), c.getLastCheckedAt(), c.getLastStatus(), c.getLastErrorCode(),
            c.getLastErrorMessage());
    }
}

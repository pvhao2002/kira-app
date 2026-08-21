package com.kira.bank.attachment;

import com.kira.bank.ai.application.AiProviderAccountService;
import com.kira.bank.ai.application.AiProviderAccountService.RuntimeR2Credential;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class R2StorageService {
    private final AiProviderAccountService accounts;
    private final CloudflareR2ClientFactory clients;
    private final Map<ClientKey, S3Client> cache = new ConcurrentHashMap<>();

    public StoredObject upload(String key, byte[] data, String contentType) {
        RuntimeR2Credential credential = accounts.primaryR2Credential();
        PutObjectRequest request = PutObjectRequest.builder().bucket(credential.bucketName()).key(key)
            .contentType(contentType).contentLength((long) data.length).build();
        client(credential).putObject(request, RequestBody.fromBytes(data));
        accounts.markR2Success(credential.id());
        return new StoredObject(credential.id(), key);
    }

    public byte[] download(Long accountId, String key) {
        RuntimeR2Credential credential = accounts.r2Credential(accountId);
        byte[] result = client(credential).getObject(
            GetObjectRequest.builder().bucket(credential.bucketName()).key(key).build(),
            ResponseTransformer.toBytes()).asByteArray();
        accounts.markR2Success(credential.id());
        return result;
    }

    public void delete(Long accountId, String key) {
        RuntimeR2Credential credential = accounts.r2Credential(accountId);
        client(credential).deleteObject(DeleteObjectRequest.builder().bucket(credential.bucketName()).key(key).build());
        accounts.markR2Success(credential.id());
    }

    public String getPublicUrl(Long accountId, String key) {
        String base = accounts.r2Credential(accountId).publicUrl();
        if (base == null || base.isBlank()) return null;
        return base.endsWith("/") ? base + key : base + "/" + key;
    }

    private S3Client client(RuntimeR2Credential credential) {
        ClientKey key = new ClientKey(credential.id(), Objects.hash(credential.accountId(), credential.accessKeyId(),
            credential.secretAccessKey(), credential.bucketName()));
        cache.entrySet().removeIf(entry -> {
            if (entry.getKey().accountId().equals(credential.id()) && !entry.getKey().equals(key)) {
                entry.getValue().close();
                return true;
            }
            return false;
        });
        return cache.computeIfAbsent(key, ignored -> clients.create(
            credential.accountId(), credential.accessKeyId(), credential.secretAccessKey()));
    }

    @PreDestroy
    void closeClients() {
        cache.values().forEach(S3Client::close);
        cache.clear();
    }

    public record StoredObject(Long accountId, String key) {}
    private record ClientKey(Long accountId, int credentialFingerprint) {}
}

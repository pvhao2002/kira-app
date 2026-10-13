package com.kira.bank.storage.application;

import com.kira.bank.ai.application.AiProviderAccountService;
import com.kira.bank.ai.domain.AiProviderAccount;
import com.kira.bank.ai.infrastructure.AiProviderAccountRepository;
import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.application.AttachmentService;
import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.shared.web.ApiException;
import com.kira.bank.storage.StorageProperties;
import com.kira.bank.storage.domain.StorageProvider;
import com.kira.bank.storage.domain.StoredFile;
import com.kira.bank.storage.infrastructure.HuggingFaceStorageService;
import com.kira.bank.storage.infrastructure.R2OperationsClient;
import com.kira.bank.storage.infrastructure.StoredFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Admin file store over Hugging Face Storage Buckets and Cloudflare R2. Uploads go to the preferred provider and fall
 * back to the other one when the preferred provider is unconfigured or fails. Storage calls run outside any DB
 * transaction; a failed row insert afterwards leaves only an orphan object.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileStorageService {
    private static final BigDecimal BYTES_PER_GB = BigDecimal.valueOf(1L << 30);
    private static final Pattern MIME_TYPE = Pattern.compile("^[\\w.+-]+/[\\w.+-]+$");
    private static final Pattern EXTENSION = Pattern.compile("\\.[A-Za-z0-9]{1,10}$");

    private final StoredFileRepository repository;
    private final R2StorageService r2;
    private final HuggingFaceStorageService huggingFace;
    private final AiProviderAccountRepository cloudflareAccounts;
    private final StorageProperties properties;
    private final UserRepository users;
    private final AiProviderAccountService cloudflareCredentials;
    private final R2OperationsClient r2Operations;

    public StoredFileResponse upload(Long adminId, StorageProvider preferred, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE_SIZE", "File không được rỗng");
        }
        byte[] data = file.getBytes();
        String mimeType = safeMimeType(file.getContentType());
        String originalName = AttachmentService.safeOriginalName(file.getOriginalFilename(), "file");
        String username = users.findById(adminId).map(User::getEmail).orElse("unknown");
        String key = r2.userFolder(adminId, username, LocalDate.now(ZoneId.of("Asia/Bangkok")))
            + "/file-" + UUID.randomUUID() + extension(originalName);
        StorageProvider target = preferred == null ? StorageProvider.R2 : preferred;
        Long r2AccountId;
        try {
            r2AccountId = put(target, key, data, mimeType);
        } catch (RuntimeException preferredFailure) {
            log.warn("Preferred storage {} failed ({}), falling back", target, preferredFailure.getClass().getSimpleName());
            target = target.other();
            try {
                r2AccountId = put(target, key, data, mimeType);
            } catch (RuntimeException fallbackFailure) {
                log.warn("Fallback storage {} failed ({})", target, fallbackFailure.getClass().getSimpleName());
                throw new ApiException(HttpStatus.BAD_GATEWAY, "FILE_STORAGE_UNAVAILABLE",
                    "Không upload được lên Hugging Face lẫn R2");
            }
        }
        StoredFile stored = new StoredFile();
        stored.setProvider(target);
        stored.setStorageKey(key);
        stored.setR2AccountId(r2AccountId);
        stored.setOriginalName(originalName);
        stored.setMimeType(mimeType);
        stored.setSizeBytes(data.length);
        stored.setSha256(sha256(data));
        stored.setCreatedBy(adminId);
        stored.setUpdatedBy(adminId);
        return toResponse(repository.save(stored));
    }

    public Page<StoredFileResponse> list(Pageable pageable) {
        return repository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable).map(this::toResponse);
    }

    /**
     * Removes the object first, then soft-deletes the row, so a failed provider call keeps the file listed and
     * retryable. S3 DeleteObject is idempotent, so a retry after a failed row update is safe.
     */
    public void delete(Long adminId, Long id) {
        StoredFile file = find(id);
        try {
            if (file.getProvider() == StorageProvider.HUGGING_FACE) {
                huggingFace.delete(file.getStorageKey());
            } else {
                r2.delete(file.getR2AccountId(), file.getStorageKey());
            }
        } catch (ApiException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            log.warn("Deleting stored file {} from {} failed ({})", id, file.getProvider(), ex.getClass().getSimpleName());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "FILE_DELETE_FAILED", "Không xóa được file trên provider");
        }
        file.setDeletedAt(Instant.now());
        file.setUpdatedBy(adminId);
        repository.save(file);
    }

    public FileContent content(Long id) {
        StoredFile file = find(id);
        byte[] bytes = file.getProvider() == StorageProvider.HUGGING_FACE
            ? huggingFace.download(file.getStorageKey())
            : r2.download(file.getR2AccountId(), file.getStorageKey());
        return new FileContent(file.getOriginalName(), bytes);
    }

    /** Live bucket listing per provider; R2's free tier applies per Cloudflare account, so each account is a row. */
    public List<ProviderUsage> usage() {
        List<ProviderUsage> rows = new ArrayList<>();
        long hfLimit = gbToBytes(properties.safeHuggingFace().safeFreeGb());
        if (!huggingFace.configured()) {
            rows.add(new ProviderUsage(StorageProvider.HUGGING_FACE, "Hugging Face", false, null, hfLimit, false, null, null));
        } else {
            rows.add(measure(StorageProvider.HUGGING_FACE, "Hugging Face", hfLimit, huggingFace::usedBytes));
        }
        long r2Limit = gbToBytes(properties.safeR2FreeGb());
        List<AiProviderAccount> r2Accounts = cloudflareAccounts.findByDeletedAtIsNullOrderByPriorityAscIdAsc().stream()
            .filter(account -> account.getR2BucketName() != null && account.getR2AccessKeyCiphertext() != null
                && account.getR2SecretKeyCiphertext() != null)
            .toList();
        if (r2Accounts.isEmpty()) {
            rows.add(new ProviderUsage(StorageProvider.R2, "Cloudflare R2", false, null, r2Limit, false, null, null));
        }
        for (AiProviderAccount account : r2Accounts) {
            ProviderUsage storage = measure(StorageProvider.R2, "R2 · " + account.getDisplayName(), r2Limit,
                () -> r2.usedBytes(account.getId()));
            rows.add(storage.withOperations(operations(account)));
        }
        return rows;
    }

    private ProviderUsage measure(StorageProvider provider, String label, long limit, java.util.function.LongSupplier used) {
        try {
            long bytes = used.getAsLong();
            return new ProviderUsage(provider, label, true, bytes, limit, bytes > limit, null, null);
        } catch (RuntimeException ex) {
            log.warn("Storage usage for {} unavailable ({})", provider, ex.getClass().getSimpleName());
            return new ProviderUsage(provider, label, true, null, limit, false, "USAGE_UNAVAILABLE", null);
        }
    }

    private OperationsUsage operations(AiProviderAccount account) {
        long limitA = properties.safeR2FreeClassAOps();
        long limitB = properties.safeR2FreeClassBOps();
        try {
            String token = cloudflareCredentials.apiTokenOrNull(account.getId());
            if (token == null) {
                return new OperationsUsage(null, limitA, null, limitB, false, "OPS_TOKEN_MISSING");
            }
            R2OperationsClient.Counts counts = r2Operations.monthToDate(account.getAccountId(), token);
            return new OperationsUsage(counts.classA(), limitA, counts.classB(), limitB,
                counts.classA() > limitA || counts.classB() > limitB, null);
        } catch (RuntimeException ex) {
            log.warn("R2 operation counts for account {} unavailable ({})", account.getId(), ex.getClass().getSimpleName());
            return new OperationsUsage(null, limitA, null, limitB, false, "OPS_UNAVAILABLE");
        }
    }

    private StoredFile find(Long id) {
        return repository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "STORED_FILE_NOT_FOUND", "Không tìm thấy file"));
    }

    private Long put(StorageProvider provider, String key, byte[] data, String mimeType) {
        if (provider == StorageProvider.HUGGING_FACE) {
            huggingFace.upload(key, data, mimeType);
            return null;
        }
        return r2.upload(key, data, mimeType).accountId();
    }

    static long gbToBytes(BigDecimal gb) {
        return gb.multiply(BYTES_PER_GB).longValue();
    }

    static String safeMimeType(String raw) {
        return raw != null && raw.length() <= 150 && MIME_TYPE.matcher(raw).matches() ? raw : "application/octet-stream";
    }

    static String extension(String fileName) {
        java.util.regex.Matcher match = EXTENSION.matcher(fileName);
        return match.find() ? match.group().toLowerCase(java.util.Locale.ROOT) : "";
    }

    private static String sha256(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private StoredFileResponse toResponse(StoredFile file) {
        return new StoredFileResponse(file.getId(), file.getProvider(), file.getOriginalName(), file.getMimeType(),
            file.getSizeBytes(), file.getCreatedAt());
    }

    public record StoredFileResponse(Long id, StorageProvider provider, String originalName, String mimeType,
                                     long sizeBytes, Instant createdAt) {
    }

    /** {@code operations} is null for Hugging Face, which has no per-operation pricing. */
    public record ProviderUsage(StorageProvider provider, String label, boolean configured, Long usedBytes,
                                long freeLimitBytes, boolean exceeded, String errorCode, OperationsUsage operations) {
        ProviderUsage withOperations(OperationsUsage ops) {
            return new ProviderUsage(provider, label, configured, usedBytes, freeLimitBytes, exceeded, errorCode, ops);
        }
    }

    /** Month-to-date (UTC) R2 operations for the whole Cloudflare account against the monthly free allowance. */
    public record OperationsUsage(Long classA, long classAFreeLimit, Long classB, long classBFreeLimit,
                                  boolean exceeded, String errorCode) {
    }

    public record FileContent(String originalName, byte[] bytes) {
    }
}

package com.kira.bank.attachment.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.ai.AiJobProperties;
import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.*;

import static com.kira.bank.attachment.application.AttachmentDtos.AiDraftResponse;
import static com.kira.bank.attachment.application.AttachmentDtos.AiTransactionDraftResponse;
import static com.kira.bank.attachment.application.AttachmentDtos.AttachmentResponse;

@Service
@RequiredArgsConstructor
public class AttachmentService {
    public static final String INVESTMENT_MODULE = "investment";
    public static final String RECEIPT_DOCUMENT_TYPE = "RECEIPT";
    public static final int INVESTMENT_AI_SCHEMA_VERSION = 2;
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final List<String> AI_IMAGE_TYPES = List.of("image/jpeg", "image/png", "image/webp");
    private static final List<String> GENERIC_FILE_TYPES = List.of("image/jpeg", "image/png", "image/webp", "application/pdf");

    private final AttachmentRepository repository;
    private final R2StorageService storage;
    private final AiJobProperties jobProperties;
    private final ObjectMapper objectMapper;
    @Value("${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    private String importTimeZone;

    private static boolean isInvestmentReceipt(String flow, String documentType) {
        return INVESTMENT_MODULE.equalsIgnoreCase(flow) && RECEIPT_DOCUMENT_TYPE.equalsIgnoreCase(documentType);
    }

    private static String normalizeFlow(String flow) {
        return flow == null ? "" : flow.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeDocumentType(String documentType) {
        return documentType == null ? "" : documentType.trim().toUpperCase(Locale.ROOT);
    }

    private static String extensionFor(String mimeType) {
        return switch (mimeType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".pdf";
        };
    }

    private static String sha256(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash attachment", ex);
        }
    }

    private static String normalizeType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return List.of("DEPOSIT", "WITHDRAWAL", "BONUS").contains(normalized) ? normalized : null;
    }

    private Instant parseInstant(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException ignored) {
            try {
                return OffsetDateTime.parse(raw).toInstant();
            } catch (DateTimeParseException ignoredAgain) {
                try {
                    return LocalDateTime.parse(raw).atZone(ZoneId.of(importTimeZone)).toInstant();
                } catch (DateTimeParseException ignoredThird) {
                    return null;
                }
            }
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Transactional
    public AttachmentResponse upload(Long userId, String flow, String documentType, MultipartFile file) throws IOException {
        String normalizedFlow = normalizeFlow(flow);
        String normalizedDocumentType = normalizeDocumentType(documentType);
        byte[] data = file.getBytes();
        String mimeType = validateFile(normalizedFlow, normalizedDocumentType, file, data);
        String hash = sha256(data);
        if (isInvestmentReceipt(normalizedFlow, normalizedDocumentType)) {
            Optional<Attachment> reusable = repository
                .findFirstByUserIdAndModuleAndDocumentTypeAndSha256AndAiSchemaVersionAndStoragePurgedAtIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(
                    userId, normalizedFlow, normalizedDocumentType, hash, INVESTMENT_AI_SCHEMA_VERSION);
            if (reusable.isPresent() && reusable.get().getAiResult() != null
                && List.of(AttachmentAiStatus.READY, AttachmentAiStatus.CONFIRMED).contains(reusable.get().getAiStatus())) {
                return toResponse(reusable.get());
            }
        }
        String key = userId + "/" + UUID.randomUUID() + extensionFor(mimeType);
        R2StorageService.StoredObject stored = storage.upload(key, data, mimeType);

        Attachment attachment = new Attachment();
        attachment.setUserId(userId);
        attachment.setModule(normalizedFlow);
        attachment.setDocumentType(normalizedDocumentType);
        attachment.setStorageKey(key);
        attachment.setR2AccountId(stored.accountId());
        attachment.setOriginalName(Optional.ofNullable(file.getOriginalFilename()).filter(s -> !s.isBlank()).orElse("document"));
        attachment.setMimeType(mimeType);
        attachment.setSizeBytes(file.getSize());
        attachment.setSha256(hash);
        attachment.setCreatedBy(userId);
        attachment.setUpdatedBy(userId);
        if (isInvestmentReceipt(normalizedFlow, normalizedDocumentType)) {
            attachment.setAiStatus(AttachmentAiStatus.PENDING);
            attachment.setAiSchemaVersion(INVESTMENT_AI_SCHEMA_VERSION);
            attachment.setAiNextAttemptAt(Instant.now());
        }
        return toResponse(repository.save(attachment));
    }

    @Transactional(readOnly = true)
    public Page<AttachmentResponse> listDrafts(Long userId, List<AttachmentAiStatus> statuses, Pageable pageable) {
        return repository.findByUserIdAndModuleAndDocumentTypeAndAiStatusInAndDeletedAtIsNull(
            userId, INVESTMENT_MODULE, RECEIPT_DOCUMENT_TYPE, statuses, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public AttachmentContent content(Long userId, Long attachmentId) {
        Attachment attachment = owned(attachmentId, userId);
        return content(attachment);
    }

    @Transactional(readOnly = true)
    public AttachmentContent investmentJobContent(Long userId, Long attachmentId) {
        Attachment attachment = owned(attachmentId, userId);
        requireInvestmentJob(attachment);
        return content(attachment);
    }

    @Transactional(readOnly = true)
    public AttachmentContent investmentJobContentAsAdmin(Long attachmentId) {
        Attachment attachment = repository.findById(attachmentId)
            .filter(value -> value.getDeletedAt() == null)
            .orElseThrow(this::missingAttachment);
        requireInvestmentJob(attachment);
        return content(attachment);
    }

    private AttachmentContent content(Attachment attachment) {
        if (attachment.getStoragePurgedAt() != null) {
            throw new ApiException(HttpStatus.GONE, "ATTACHMENT_PURGED", "Ảnh nguồn đã hết thời hạn lưu trữ");
        }
        return new AttachmentContent(attachment.getMimeType(), attachment.getOriginalName(),
            storage.download(attachment.getR2AccountId(), attachment.getStorageKey()));
    }

    @Transactional
    public AttachmentResponse retry(Long userId, Long attachmentId) {
        Attachment attachment = repository.findOwnedForUpdate(attachmentId, userId)
            .orElseThrow(this::missingAttachment);
        rerun(attachment, userId);
        return toResponse(attachment);
    }

    @Transactional
    public AttachmentResponse retryAsAdmin(Long adminId, Long attachmentId) {
        Attachment attachment = repository.findForUpdate(attachmentId).orElseThrow(this::missingAttachment);
        rerun(attachment, adminId);
        return toResponse(attachment);
    }

    private void rerun(Attachment attachment, Long actorId) {
        requireInvestmentJob(attachment);
        if (!List.of(AttachmentAiStatus.FAILED, AttachmentAiStatus.CANCELLED).contains(attachment.getAiStatus())) {
            throw conflict("AI_JOB_NOT_RERUNNABLE", "Chỉ có thể chạy lại job FAILED hoặc CANCELLED");
        }
        resetForRun(attachment, actorId);
    }

    private void resetForRun(Attachment attachment, Long actorId) {
        attachment.setAiStatus(AttachmentAiStatus.PENDING);
        attachment.setAiAttemptCount(0);
        attachment.setAiModel(null);
        attachment.setAiError(null);
        attachment.setAiRawResponse(null);
        attachment.setAiResult(null);
        attachment.setAiNextAttemptAt(Instant.now());
        attachment.setAiProcessingStartedAt(null);
        attachment.setAiCompletedAt(null);
        attachment.setAiConfirmedAt(null);
        attachment.setAiSchemaVersion(INVESTMENT_AI_SCHEMA_VERSION);
        attachment.setUpdatedBy(actorId);
    }

    @Transactional
    public Attachment claimImmediateRun(Long userId, Long attachmentId) {
        Attachment attachment = repository.findOwnedForUpdate(attachmentId, userId)
            .orElseThrow(this::missingAttachment);
        return claimImmediateRun(attachment, userId);
    }

    @Transactional
    public Attachment claimImmediateRunAsAdmin(Long adminId, Long attachmentId) {
        Attachment attachment = repository.findForUpdate(attachmentId).orElseThrow(this::missingAttachment);
        return claimImmediateRun(attachment, adminId);
    }

    private Attachment claimImmediateRun(Attachment attachment, Long actorId) {
        requireInvestmentJob(attachment);
        if (!List.of(AttachmentAiStatus.PENDING, AttachmentAiStatus.FAILED, AttachmentAiStatus.CANCELLED)
            .contains(attachment.getAiStatus())) {
            throw conflict("AI_JOB_NOT_RUNNABLE", "Chỉ có thể chạy job PENDING, FAILED hoặc CANCELLED");
        }
        if (attachment.getAiStatus() != AttachmentAiStatus.PENDING) {
            resetForRun(attachment, actorId);
        }
        Instant now = Instant.now();
        attachment.setAiStatus(AttachmentAiStatus.PROCESSING);
        attachment.setAiAttemptCount(attachment.getAiAttemptCount() + 1);
        attachment.setAiProcessingStartedAt(now);
        attachment.setAiNextAttemptAt(null);
        attachment.setAiCompletedAt(null);
        attachment.setAiError(null);
        attachment.setUpdatedBy(actorId);
        return attachment;
    }

    @Transactional
    public AttachmentResponse cancel(Long userId, Long attachmentId) {
        Attachment attachment = repository.findOwnedForUpdate(attachmentId, userId)
            .orElseThrow(this::missingAttachment);
        cancel(attachment, userId);
        return toResponse(attachment);
    }

    @Transactional
    public AttachmentResponse cancelAsAdmin(Long adminId, Long attachmentId) {
        Attachment attachment = repository.findForUpdate(attachmentId).orElseThrow(this::missingAttachment);
        cancel(attachment, adminId);
        return toResponse(attachment);
    }

    private void cancel(Attachment attachment, Long actorId) {
        requireInvestmentJob(attachment);
        if (attachment.getAiStatus() != AttachmentAiStatus.PENDING) {
            throw conflict("AI_JOB_NOT_CANCELLABLE", "Chỉ có thể hủy job đang chờ xử lý");
        }
        attachment.setAiStatus(AttachmentAiStatus.CANCELLED);
        attachment.setAiNextAttemptAt(null);
        attachment.setAiProcessingStartedAt(null);
        attachment.setAiCompletedAt(Instant.now());
        attachment.setAiError(null);
        attachment.setUpdatedBy(actorId);
    }

    @Transactional
    public List<Attachment> claimNextBatch() {
        Instant now = Instant.now();
        List<Attachment> claimed = repository.findClaimableForUpdate(
            INVESTMENT_MODULE,
            RECEIPT_DOCUMENT_TYPE,
            AttachmentAiStatus.PENDING,
            now,
            PageRequest.of(0, jobProperties.safeBatchSize())
        );
        for (Attachment attachment : claimed) {
            attachment.setAiStatus(AttachmentAiStatus.PROCESSING);
            attachment.setAiAttemptCount(attachment.getAiAttemptCount() + 1);
            attachment.setAiProcessingStartedAt(now);
            attachment.setAiNextAttemptAt(null);
            attachment.setAiError(null);
        }
        return claimed;
    }

    @Transactional
    public void recoverStaleProcessing() {
        Instant now = Instant.now();
        Instant cutoff = now.minus(jobProperties.safeProcessingTimeout());
        for (Attachment attachment : repository.findStaleProcessingForUpdate(
            INVESTMENT_MODULE, RECEIPT_DOCUMENT_TYPE, AttachmentAiStatus.PROCESSING, cutoff)) {
            if (attachment.getAiAttemptCount() >= jobProperties.safeMaxAttempts()) {
                attachment.setAiStatus(AttachmentAiStatus.FAILED);
                attachment.setAiError("AI_PROCESSING_TIMEOUT");
                attachment.setAiCompletedAt(now);
            } else {
                attachment.setAiStatus(AttachmentAiStatus.PENDING);
                attachment.setAiError("AI_PROCESSING_TIMEOUT");
                attachment.setAiNextAttemptAt(now);
            }
            attachment.setAiProcessingStartedAt(null);
        }
    }

    @Transactional
    public void markReady(Long attachmentId, AiDocumentService.AiExtraction extraction, String rawResponse, String model) {
        Attachment attachment = repository.findById(attachmentId).orElseThrow();
        if (attachment.getAiStatus() != AttachmentAiStatus.PROCESSING) {
            return;
        }
        AiDraftResponse draft = sanitize(extraction, attachmentId);
        attachment.setAiStatus(AttachmentAiStatus.READY);
        attachment.setAiModel(model);
        attachment.setAiRawResponse(rawResponse);
        attachment.setAiResult(serialize(draft));
        attachment.setAiError(null);
        attachment.setAiProcessingStartedAt(null);
        attachment.setAiCompletedAt(Instant.now());
    }

    @Transactional
    public void markRetryOrFailed(Long attachmentId, String reason) {
        Attachment attachment = repository.findById(attachmentId).orElseThrow();
        if (attachment.getAiStatus() != AttachmentAiStatus.PROCESSING) {
            return;
        }
        attachment.setAiError(reason);
        attachment.setAiProcessingStartedAt(null);
        if (attachment.getAiAttemptCount() >= jobProperties.safeMaxAttempts()) {
            attachment.setAiStatus(AttachmentAiStatus.FAILED);
            attachment.setAiCompletedAt(Instant.now());
            attachment.setAiNextAttemptAt(null);
        } else {
            attachment.setAiStatus(AttachmentAiStatus.PENDING);
            attachment.setAiNextAttemptAt(Instant.now().plus(jobProperties.safeRetryDelay()));
        }
    }

    @Transactional
    public Attachment requireReadyForConfirmation(Long userId, Long attachmentId) {
        Attachment attachment = repository.findOwnedForUpdate(attachmentId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Không tìm thấy tệp đính kèm"));
        if (attachment.getAiStatus() != AttachmentAiStatus.READY) {
            throw bad("ATTACHMENT_NOT_READY", "Ảnh chưa sẵn sàng để xác nhận giao dịch");
        }
        return attachment;
    }

    @Transactional
    public void markConfirmed(Long userId, Long attachmentId) {
        Attachment attachment = owned(attachmentId, userId);
        if (attachment.getAiStatus() == AttachmentAiStatus.CONFIRMED) {
            return;
        }
        if (attachment.getAiStatus() != AttachmentAiStatus.READY) {
            throw bad("ATTACHMENT_ALREADY_CONFIRMED", "Ảnh đã được dùng hoặc chưa sẵn sàng");
        }
        attachment.setAiStatus(AttachmentAiStatus.CONFIRMED);
        attachment.setAiConfirmedAt(Instant.now());
        attachment.setUpdatedBy(userId);
    }

    private Attachment owned(Long attachmentId, Long userId) {
        return repository.findByIdAndUserIdAndDeletedAtIsNull(attachmentId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Không tìm thấy tệp đính kèm"));
    }

    private void requireInvestmentJob(Attachment attachment) {
        if (!isInvestmentReceipt(attachment.getModule(), attachment.getDocumentType())) {
            throw missingAttachment();
        }
    }

    private String validateFile(String flow, String documentType, MultipartFile file, byte[] data) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_FILE_SIZE) {
            throw bad("INVALID_FILE_SIZE", "File phải có dung lượng từ 1 byte đến 10 MB");
        }
        String contentType = detectedImageType(data);
        if (contentType == null && "application/pdf".equals(file.getContentType()) && data.length >= 5
            && new String(data, 0, 5, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) {
            contentType = "application/pdf";
        }
        if (contentType == null || !(isInvestmentReceipt(flow, documentType)
            ? AI_IMAGE_TYPES.contains(contentType)
            : GENERIC_FILE_TYPES.contains(contentType))) {
            throw bad("INVALID_FILE_TYPE", isInvestmentReceipt(flow, documentType)
                ? "Ảnh giao dịch chỉ hỗ trợ JPEG, PNG hoặc WebP"
                : "Chỉ hỗ trợ JPEG, PNG, WebP hoặc PDF");
        }
        if (file.getContentType() != null && !file.getContentType().equals(contentType)) {
            throw bad("FILE_CONTENT_TYPE_MISMATCH", "Nội dung file không khớp MIME type khai báo");
        }
        return contentType;
    }

    private String detectedImageType(byte[] data) {
        if (data.length >= 3 && (data[0] & 0xff) == 0xff && (data[1] & 0xff) == 0xd8 && (data[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        byte[] png = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        if (data.length >= png.length && java.util.Arrays.equals(java.util.Arrays.copyOf(data, png.length), png)) {
            return "image/png";
        }
        if (data.length >= 12 && new String(data, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF")
            && new String(data, 8, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP")) {
            return "image/webp";
        }
        return null;
    }

    private AttachmentResponse toResponse(Attachment attachment) {
        return new AttachmentResponse(
            attachment.getId(),
            attachment.getOriginalName(),
            attachment.getMimeType(),
            attachment.getSizeBytes(),
            attachment.getSha256(),
            attachment.getModule(),
            attachment.getDocumentType(),
            attachment.getAiStatus(),
            attachment.getAiAttemptCount(),
            "/api/v1/attachments/" + attachment.getId() + "/content",
            parseDraft(attachment.getAiResult()),
            attachment.getAiError(),
            attachment.getCreatedAt()
        );
    }

    AiDraftResponse parseDraft(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(value, AiDraftResponse.class);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String serialize(AiDraftResponse draft) {
        try {
            return objectMapper.writeValueAsString(draft);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to persist AI draft", ex);
        }
    }

    private AiDraftResponse sanitize(AiDocumentService.AiExtraction extraction, Long attachmentId) {
        List<AiTransactionDraftResponse> transactions = new ArrayList<>();
        for (AiDocumentService.AiTransactionExtraction transaction :
            Optional.ofNullable(extraction.transactions()).orElse(List.of())) {
            List<String> warnings = new ArrayList<>(Optional.ofNullable(transaction.validationWarnings()).orElse(List.of()));
            String type = normalizeType(transaction.transactionType());
            if (transaction.transactionType() != null && type == null) warnings.add("UNSUPPORTED_TRANSACTION_TYPE");
            String status = normalizeStatus(transaction.transactionStatus());
            if (transaction.transactionStatus() != null && status == null) warnings.add("UNSUPPORTED_TRANSACTION_STATUS");
            BigDecimal amount = transaction.amount();
            if (amount != null && amount.signum() < 0) {
                amount = amount.abs();
                warnings.add("NEGATIVE_AMOUNT_TYPE_SIGNAL");
            } else if (amount != null && amount.signum() == 0) {
                amount = null;
                warnings.add("INVALID_AMOUNT");
            }
            Instant transactionAt = parseInstant(transaction.transactionAt());
            if (transaction.transactionAt() != null && transactionAt == null) warnings.add("INVALID_TRANSACTION_TIME");
            transactions.add(new AiTransactionDraftResponse(
                type, status, amount, trimToNull(transaction.currency()), transactionAt,
                trimToNull(transaction.externalTransactionId()), trimToNull(transaction.description()),
                trimToNull(transaction.rawText()), transaction.confidence(),
                Optional.ofNullable(transaction.uncertainFields()).orElse(List.of()), List.copyOf(warnings)
            ));
        }
        return new AiDraftResponse(attachmentId, List.copyOf(transactions));
    }

    private String normalizeStatus(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return List.of("PENDING", "COMPLETED", "FAILED", "CANCELLED").contains(normalized) ? normalized : null;
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    private ApiException missingAttachment() {
        return new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Không tìm thấy tệp đính kèm");
    }

    public record AttachmentContent(String mimeType, String originalName, byte[] bytes) {
    }
}

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
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static com.kira.bank.attachment.application.AttachmentDtos.*;

@Service
@RequiredArgsConstructor
public class AttachmentService {
    public static final String INVESTMENT_MODULE = "investment";
    public static final String RECEIPT_DOCUMENT_TYPE = "RECEIPT";
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final List<String> AI_IMAGE_TYPES = List.of("image/jpeg", "image/png", "image/webp");
    private static final List<String> GENERIC_FILE_TYPES = List.of("image/jpeg", "image/png", "image/webp", "application/pdf");

    private final AttachmentRepository repository;
    private final R2StorageService storage;
    private final AiJobProperties jobProperties;
    private final ObjectMapper objectMapper;

    @Transactional
    public AttachmentResponse upload(Long userId, String flow, String documentType, MultipartFile file) throws IOException {
        String normalizedFlow = normalizeFlow(flow);
        String normalizedDocumentType = normalizeDocumentType(documentType);
        validateFile(normalizedFlow, normalizedDocumentType, file);
        String mimeType = file.getContentType();
        byte[] data = file.getBytes();
        String key = userId + "/" + UUID.randomUUID() + extensionFor(mimeType);
        storage.upload(key, data, mimeType);

        Attachment attachment = new Attachment();
        attachment.setUserId(userId);
        attachment.setModule(normalizedFlow);
        attachment.setDocumentType(normalizedDocumentType);
        attachment.setStorageKey(key);
        attachment.setOriginalName(Optional.ofNullable(file.getOriginalFilename()).filter(s -> !s.isBlank()).orElse("document"));
        attachment.setMimeType(mimeType);
        attachment.setSizeBytes(file.getSize());
        attachment.setSha256(sha256(data));
        attachment.setCreatedBy(userId);
        attachment.setUpdatedBy(userId);
        if (isInvestmentReceipt(normalizedFlow, normalizedDocumentType)) {
            attachment.setAiStatus(AttachmentAiStatus.PENDING);
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
        return new AttachmentContent(attachment.getMimeType(), attachment.getOriginalName(), storage.download(attachment.getStorageKey()));
    }

    @Transactional
    public AttachmentResponse retry(Long userId, Long attachmentId) {
        Attachment attachment = owned(attachmentId, userId);
        if (attachment.getAiStatus() != AttachmentAiStatus.FAILED) {
            throw bad("ATTACHMENT_NOT_RETRYABLE", "Chỉ có thể thử lại ảnh AI đã xử lý lỗi");
        }
        attachment.setAiStatus(AttachmentAiStatus.PENDING);
        attachment.setAiAttemptCount(0);
        attachment.setAiError(null);
        attachment.setAiRawResponse(null);
        attachment.setAiResult(null);
        attachment.setAiNextAttemptAt(Instant.now());
        attachment.setAiProcessingStartedAt(null);
        attachment.setAiCompletedAt(null);
        attachment.setUpdatedBy(userId);
        return toResponse(attachment);
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
    public void markReady(Long attachmentId, AiDocumentService.AiExtraction extraction, String rawResponse) {
        Attachment attachment = repository.findById(attachmentId).orElseThrow();
        if (attachment.getAiStatus() != AttachmentAiStatus.PROCESSING) {
            return;
        }
        AiDraftResponse draft = sanitize(extraction, attachmentId);
        attachment.setAiStatus(AttachmentAiStatus.READY);
        attachment.setAiModel("@cf/moonshotai/kimi-k2.7-code");
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

    private void validateFile(String flow, String documentType, MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_FILE_SIZE) {
            throw bad("INVALID_FILE_SIZE", "File phải có dung lượng từ 1 byte đến 10 MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !(isInvestmentReceipt(flow, documentType)
                ? AI_IMAGE_TYPES.contains(contentType)
                : GENERIC_FILE_TYPES.contains(contentType))) {
            throw bad("INVALID_FILE_TYPE", isInvestmentReceipt(flow, documentType)
                    ? "Ảnh giao dịch chỉ hỗ trợ JPEG, PNG hoặc WebP"
                    : "Chỉ hỗ trợ JPEG, PNG, WebP hoặc PDF");
        }
    }

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

    private AiDraftResponse parseDraft(String value) {
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
        List<String> warnings = new ArrayList<>(Optional.ofNullable(extraction.validationWarnings()).orElse(List.of()));
        String type = normalizeType(extraction.type());
        if (extraction.type() != null && type == null) {
            warnings.add("Unsupported transaction type returned by AI");
        }
        BigDecimal amount = extraction.amount();
        if (amount != null && amount.signum() <= 0) {
            amount = null;
            warnings.add("Amount must be greater than zero");
        }
        Instant transactionDate = parseInstant(extraction.transactionDate());
        if (extraction.transactionDate() != null && transactionDate == null) {
            warnings.add("Transaction date could not be parsed");
        }
        return new AiDraftResponse(
                attachmentId,
                type,
                amount,
                transactionDate,
                trimToNull(extraction.description()),
                extraction.confidence(),
                Optional.ofNullable(extraction.uncertainFields()).orElse(List.of()),
                List.copyOf(warnings)
        );
    }

    private static String normalizeType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return List.of("DEPOSIT", "WITHDRAWAL", "BONUS").contains(normalized) ? normalized : null;
    }

    private static Instant parseInstant(String raw) {
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
                    return LocalDateTime.parse(raw).atZone(ZoneId.of("Asia/Bangkok")).toInstant();
                } catch (DateTimeParseException ignoredThird) {
                    return null;
                }
            }
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    public record AttachmentContent(String mimeType, String originalName, byte[] bytes) {
    }
}

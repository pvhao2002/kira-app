package com.kira.bank.attachment.application;

import com.kira.bank.attachment.domain.AttachmentAiStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class AttachmentDtos {
    private AttachmentDtos() {
    }

    public record AiTransactionDraftResponse(
        String transactionType,
        String transactionStatus,
        BigDecimal amount,
        String currency,
        Instant transactionAt,
        String externalTransactionId,
        String description,
        String rawText,
        Double confidence,
        List<String> uncertainFields,
        List<String> validationWarnings
    ) {
    }

    public record AiDraftResponse(Long attachmentId, List<AiTransactionDraftResponse> transactions) {
    }

    public record AttachmentResponse(
        Long attachmentId,
        String originalName,
        String mimeType,
        long size,
        String sha256,
        String flow,
        String documentType,
        AttachmentAiStatus aiStatus,
        int aiAttemptCount,
        String contentUrl,
        AiDraftResponse draft,
        String aiError,
        Instant createdAt
    ) {
    }
}

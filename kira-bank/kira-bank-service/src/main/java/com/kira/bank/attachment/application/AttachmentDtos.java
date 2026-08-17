package com.kira.bank.attachment.application;

import com.kira.bank.attachment.domain.AttachmentAiStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class AttachmentDtos {
    private AttachmentDtos() {
    }

    public record AiDraftResponse(
        Long attachmentId,
        String type,
        BigDecimal amount,
        Instant transactionDate,
        String description,
        Double confidence,
        List<String> uncertainFields,
        List<String> validationWarnings
    ) {
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

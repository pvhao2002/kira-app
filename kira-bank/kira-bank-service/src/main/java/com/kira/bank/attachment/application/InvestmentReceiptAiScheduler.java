package com.kira.bank.attachment.application;

import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.domain.Attachment;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@RequiredArgsConstructor
public class InvestmentReceiptAiScheduler {
    private static final Logger log = LoggerFactory.getLogger(InvestmentReceiptAiScheduler.class);

    private final AttachmentService attachments;
    private final R2StorageService storage;
    private final AiDocumentService ai;
    private final AtomicBoolean running = new AtomicBoolean();

    @Scheduled(cron = "${ai.job.cron:0 0 */3 * * *}", zone = "${ai.job.time-zone:Asia/Bangkok}")
    public void processPendingReceipts() {
        if (!ai.isConfigured() || !running.compareAndSet(false, true)) {
            return;
        }
        try {
            attachments.recoverStaleProcessing();
            while (processOneBatch()) {
                // Keep draining the backlog in groups of at most three images.
            }
        } finally {
            running.set(false);
        }
    }

    private boolean processOneBatch() {
        List<Attachment> claimed = attachments.claimNextBatch();
        if (claimed.isEmpty()) {
            return false;
        }

        List<AiDocumentService.AiInputDocument> documents = new ArrayList<>();
        for (Attachment attachment : claimed) {
            try {
                documents.add(new AiDocumentService.AiInputDocument(
                        attachment.getId(), attachment.getMimeType(), storage.download(attachment.getStorageKey())));
            } catch (RuntimeException ex) {
                attachments.markRetryOrFailed(attachment.getId(), "ATTACHMENT_STORAGE_UNAVAILABLE");
                log.warn("Unable to read attachment {} for AI processing", attachment.getId());
            }
        }
        if (documents.isEmpty()) {
            return true;
        }

        try {
            AiDocumentService.AiBatchResponse response = ai.analyzeBatch(documents);
            Map<Long, AiDocumentService.AiExtraction> resultsByAttachment = new HashMap<>();
            Set<Long> requestedIds = new HashSet<>();
            for (AiDocumentService.AiInputDocument document : documents) {
                requestedIds.add(document.attachmentId());
            }
            for (AiDocumentService.AiExtraction result : response.results()) {
                if (result.attachmentId() != null && requestedIds.contains(result.attachmentId())) {
                    resultsByAttachment.putIfAbsent(result.attachmentId(), result);
                }
            }
            for (AiDocumentService.AiInputDocument document : documents) {
                AiDocumentService.AiExtraction result = resultsByAttachment.get(document.attachmentId());
                if (result == null) {
                    attachments.markRetryOrFailed(document.attachmentId(), "AI_RESULT_MISSING");
                } else {
                    attachments.markReady(document.attachmentId(), result, response.rawResponse());
                }
            }
        } catch (AiDocumentService.AiProviderException ex) {
            for (AiDocumentService.AiInputDocument document : documents) {
                attachments.markRetryOrFailed(document.attachmentId(), "AI_PROVIDER_ERROR");
            }
            log.warn("Cloudflare AI batch failed for {} attachment(s)", documents.size());
        }
        return true;
    }
}

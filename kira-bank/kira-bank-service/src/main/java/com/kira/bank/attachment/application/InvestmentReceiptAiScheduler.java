package com.kira.bank.attachment.application;

import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.investment.application.InvestmentTransactionImportService;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.*;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@RequiredArgsConstructor
public class InvestmentReceiptAiScheduler {
    private static final Logger log = LoggerFactory.getLogger(InvestmentReceiptAiScheduler.class);

    private final AttachmentService attachments;
    private final R2StorageService storage;
    private final AiDocumentService ai;
    private final InvestmentTransactionImportService transactionImports;
    private final MeterRegistry metrics;
    private final AtomicBoolean running = new AtomicBoolean();

    @Scheduled(cron = "${ai.job.cron:0 0 */3 * * *}", zone = "${ai.job.time-zone:Asia/Bangkok}")
    public void processPendingReceipts() {
        if (!ai.isConfigured()) {
            log.warn("Investment receipt AI scheduler skipped because the provider configuration is incomplete: {}",
                ai.safeConfigurationSummary());
            return;
        }
        if (!running.compareAndSet(false, true)) {
            log.debug("Investment receipt AI scheduler skipped because a previous run is still active");
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
        processClaimedAttachments(claimed);
        return true;
    }

    public void processClaimedAttachments(List<Attachment> claimed) {
        long startedAt = System.nanoTime();
        claimed.forEach(attachment -> transactionImports.refreshAttachmentState(attachment.getId()));

        List<AiDocumentService.AiInputDocument> documents = new ArrayList<>();
        for (Attachment attachment : claimed) {
            try {
                documents.add(new AiDocumentService.AiInputDocument(
                    attachment.getId(), attachment.getMimeType(),
                    storage.download(attachment.getR2AccountId(), attachment.getStorageKey())));
            } catch (RuntimeException ex) {
                attachments.markRetryOrFailed(attachment.getId(), "ATTACHMENT_STORAGE_UNAVAILABLE");
                transactionImports.refreshAttachmentState(attachment.getId());
                metrics.counter("investment.import.ai.failure", "reason", "storage").increment();
                log.warn("Unable to read attachment {} for AI processing", attachment.getId());
            }
        }
        if (documents.isEmpty()) {
            recordProcessingTime(startedAt);
            return;
        }

        List<Long> attachmentIds = documents.stream()
            .map(AiDocumentService.AiInputDocument::attachmentId)
            .toList();
        try {
            log.info("Calling Cloudflare AI for {} investment receipt(s), attachmentIds={}, provider={}",
                documents.size(), attachmentIds, ai.safeConfigurationSummary());
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
                    metrics.counter("investment.import.ai.failure", "reason", "missing_result").increment();
                } else {
                    attachments.markReady(document.attachmentId(), result, response.rawResponse(), response.model());
                }
                transactionImports.refreshAttachmentState(document.attachmentId());
            }
            log.info("Cloudflare AI batch completed for {} investment receipt(s), attachmentIds={}",
                documents.size(), attachmentIds);
        } catch (AiDocumentService.AiProviderException ex) {
            for (AiDocumentService.AiInputDocument document : documents) {
                attachments.markRetryOrFailed(document.attachmentId(), "AI_PROVIDER_ERROR");
                transactionImports.refreshAttachmentState(document.attachmentId());
            }
            metrics.counter("investment.import.ai.failure", "reason", "provider").increment(documents.size());
            log.warn("Cloudflare AI batch failed for {} attachment(s), attachmentIds={}: {}",
                documents.size(), attachmentIds, ex.getMessage());
        }
        recordProcessingTime(startedAt);
    }

    private void recordProcessingTime(long startedAt) {
        metrics.timer("investment.import.ai.processing.time")
            .record(Duration.ofNanos(System.nanoTime() - startedAt));
    }
}

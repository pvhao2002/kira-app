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

import java.time.Duration;
import java.util.*;
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
        if (!running.compareAndSet(false, true)) {
            return; // A previous run is still active.
        }
        try {
            sweepUnfinishedImports();
            processPendingReceiptsLocked();
        } finally {
            running.set(false);
        }
    }

    private void sweepUnfinishedImports() {
        try {
            transactionImports.processUnfinished(); // DB-only; needs no AI provider
        } catch (RuntimeException ex) {
            log.warn("Investment import sweep failed error={}", ex.getClass().getSimpleName());
        }
    }

    private void processPendingReceiptsLocked() {
        if (!ai.isConfigured()) {
            log.warn("Investment receipt AI scheduler skipped because the provider configuration is incomplete: {}",
                ai.safeConfigurationSummary());
            return;
        }
        attachments.recoverStaleProcessing();
        while (processOneBatch()) {
            // Keep draining the backlog in groups of at most three images.
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
        List<AiDocumentService.AiInputDocument> documents = new ArrayList<>();
        for (Attachment attachment : claimed) {
            try {
                documents.add(new AiDocumentService.AiInputDocument(
                    attachment.getId(), attachment.getMimeType(),
                    storage.download(attachment.getR2AccountId(), attachment.getStorageKey())));
            } catch (RuntimeException _) {
                attachments.markRetryOrFailed(attachment.getId(), "ATTACHMENT_STORAGE_UNAVAILABLE");
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
            log.info("Calling Cloudflare AI for {} investment receipt(s), attachmentIds={}", documents.size(), attachmentIds);
            // The provider summary loads and decrypts every account; only build it when debugging.
            if (log.isDebugEnabled()) log.debug("AI provider: {}", ai.safeConfigurationSummary());
            AiDocumentService.AiBatchResponse response = ai.analyzeBatch(documents);
            // The model sometimes splits one attachment's transactions across several result
            // entries that all share the same attachmentId instead of one entry with them all
            // in its transactions array, so merge by attachmentId rather than keep only one.
            Map<Long, List<AiDocumentService.AiTransactionExtraction>> transactionsByAttachment = new HashMap<>();
            Set<Long> requestedIds = new HashSet<>();
            for (AiDocumentService.AiInputDocument document : documents) {
                requestedIds.add(document.attachmentId());
            }
            for (AiDocumentService.AiExtraction result : response.results()) {
                if (result.attachmentId() != null && requestedIds.contains(result.attachmentId())
                    && result.transactions() != null) {
                    transactionsByAttachment.computeIfAbsent(result.attachmentId(), id -> new ArrayList<>())
                        .addAll(result.transactions());
                }
            }
            for (AiDocumentService.AiInputDocument document : documents) {
                List<AiDocumentService.AiTransactionExtraction> transactions =
                    transactionsByAttachment.get(document.attachmentId());
                if (transactions == null) {
                    attachments.markRetryOrFailed(document.attachmentId(), "AI_RESULT_MISSING");
                    metrics.counter("investment.import.ai.failure", "reason", "missing_result").increment();
                } else {
                    attachments.markReady(document.attachmentId(),
                        new AiDocumentService.AiExtraction(document.attachmentId(), transactions),
                        response.rawResponse(), response.model());
                    processExtracted(document.attachmentId());
                }
            }
            log.info("Cloudflare AI batch completed for {} investment receipt(s), attachmentIds={}",
                documents.size(), attachmentIds);
        } catch (AiDocumentService.AiProviderException ex) {
            for (AiDocumentService.AiInputDocument document : documents) {
                attachments.markRetryOrFailed(document.attachmentId(), "AI_PROVIDER_ERROR");
            }
            metrics.counter("investment.import.ai.failure", "reason", "provider").increment(documents.size());
            log.warn("Cloudflare AI batch failed for {} attachment(s), attachmentIds={}: {}",
                documents.size(), attachmentIds, ex.getMessage());
        }
        recordProcessingTime(startedAt);
    }

    private void processExtracted(Long attachmentId) {
        try {
            transactionImports.processExtracted(attachmentId);
        } catch (RuntimeException ex) {
            // The sweep in processPendingReceipts retries.
            log.warn("Investment import auto-record deferred attachmentId={} error={}",
                attachmentId, ex.getClass().getSimpleName());
        }
    }

    private void recordProcessingTime(long startedAt) {
        metrics.timer("investment.import.ai.processing.time")
            .record(Duration.ofNanos(System.nanoTime() - startedAt));
    }
}

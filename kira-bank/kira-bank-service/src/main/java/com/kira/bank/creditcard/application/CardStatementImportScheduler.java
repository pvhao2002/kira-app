package com.kira.bank.creditcard.application;

import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.creditcard.domain.CardStatementImport;
import com.kira.bank.creditcard.domain.CardStatementImportFile;
import com.kira.bank.creditcard.domain.CardStatementImportStatus;
import com.kira.bank.creditcard.infrastructure.CardStatementImportFileRepository;
import com.kira.bank.creditcard.infrastructure.CardStatementImportRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

/** Fallback for imports the immediate runner could not start, retries, stale runs and 30-day image purge. */
@Component
@RequiredArgsConstructor
public class CardStatementImportScheduler {
    private static final Logger log = LoggerFactory.getLogger(CardStatementImportScheduler.class);
    private static final int MAX_IMPORTS_PER_RUN = 50;

    private final CardStatementImportService imports;
    private final CardStatementAiProcessor processor;
    private final AiDocumentService ai;
    private final CardStatementImportRepository importRepository;
    private final CardStatementImportFileRepository files;
    private final AttachmentRepository attachments;
    private final R2StorageService storage;
    private final AtomicBoolean running = new AtomicBoolean();

    @Scheduled(cron = "${credit-card.statement-import.cron:0 10 * * * *}",
        zone = "${ai.job.time-zone:Asia/Bangkok}")
    public void processQueued() {
        if (!ai.isConfigured()) {
            log.warn("Credit card statement import scheduler skipped because AI is not configured: {}",
                ai.safeConfigurationSummary());
            return;
        }
        if (!running.compareAndSet(false, true)) return;
        try {
            imports.recoverStaleProcessing();
            for (int i = 0; i < MAX_IMPORTS_PER_RUN; i++) {
                Optional<CardStatementImportService.ClaimedImport> claimed = imports.claimNext();
                if (claimed.isEmpty()) break;
                processor.process(claimed.get());
            }
        } finally {
            running.set(false);
        }
    }

    @Scheduled(cron = "${credit-card.statement-import.retention-cron:0 40 2 * * *}",
        zone = "${ai.job.time-zone:Asia/Bangkok}")
    public void purgeExpiredStorage() {
        Instant now = Instant.now();
        List<CardStatementImport> expired = importRepository.findExpired(List.of(CardStatementImportStatus.READY,
            CardStatementImportStatus.CONFIRMED, CardStatementImportStatus.FAILED, CardStatementImportStatus.CANCELLED), now, PageRequest.of(0, 200));
        for (CardStatementImport statementImport : expired) {
            boolean allPurged = true;
            for (CardStatementImportFile file :
                files.findByImportIdAndDeletedAtIsNullOrderByPageNumberAsc(statementImport.getId())) {
                allPurged &= purgeAttachment(file.getAttachmentId(), now);
            }
            if (allPurged) {
                statementImport.setStoragePurgedAt(now);
                importRepository.saveAndFlush(statementImport);
            }
        }
    }

    private boolean purgeAttachment(Long attachmentId, Instant now) {
        var attachment = attachments.findById(attachmentId).orElse(null);
        if (attachment == null || attachment.getStoragePurgedAt() != null) return true;
        try {
            storage.delete(attachment.getR2AccountId(), attachment.getStorageKey());
            attachment.setStoragePurgedAt(now);
            attachments.saveAndFlush(attachment);
            return true;
        } catch (RuntimeException ex) {
            log.warn("Statement import attachment purge failed attachmentId={} error={}",
                attachmentId, ex.getClass().getSimpleName());
            return false;
        }
    }
}

package com.kira.bank.investment.application;

import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.investment.domain.InvestmentImportBatchStatus;
import com.kira.bank.investment.infrastructure.InvestmentTransactionImportBatchRepository;
import com.kira.bank.investment.infrastructure.InvestmentTransactionImportFileRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class InvestmentImportRetentionScheduler {
    private static final Logger log = LoggerFactory.getLogger(InvestmentImportRetentionScheduler.class);

    private final InvestmentTransactionImportBatchRepository batches;
    private final InvestmentTransactionImportFileRepository files;
    private final AttachmentRepository attachments;
    private final R2StorageService storage;

    @Scheduled(cron = "${investment.transaction-import.retention-cron:0 20 2 * * *}",
        zone = "${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    public void purgeExpiredStorage() {
        Instant now = Instant.now();
        Set<Long> visited = new HashSet<>();
        for (var batch : batches.findExpired(
            List.of(InvestmentImportBatchStatus.CONFIRMED, InvestmentImportBatchStatus.FAILED), now)) {
            for (var file : files.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId())) {
                if (!visited.add(file.getAttachmentId())
                    || files.countUnexpiredBatchLinks(file.getAttachmentId(), now) > 0) continue;
                purgeOne(file.getAttachmentId(), now);
            }
        }
    }

    public void purgeOne(Long attachmentId, Instant purgedAt) {
        Attachment attachment = attachments.findById(attachmentId).orElse(null);
        if (attachment == null || attachment.getStoragePurgedAt() != null) return;
        try {
            storage.delete(attachment.getStorageKey());
            attachment.setStoragePurgedAt(purgedAt);
            attachments.saveAndFlush(attachment);
            log.info("Investment import attachment purged attachmentId={} userId={}",
                attachmentId, attachment.getUserId());
        } catch (RuntimeException ex) {
            log.warn("Investment import attachment purge failed attachmentId={} userId={} error={}",
                attachmentId, attachment.getUserId(), ex.getClass().getSimpleName());
        }
    }
}

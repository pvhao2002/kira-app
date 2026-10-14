package com.kira.bank.investment.application;

import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class InvestmentImportRetentionScheduler {
    private static final Logger log = LoggerFactory.getLogger(InvestmentImportRetentionScheduler.class);

    private static final Duration RETENTION = Duration.ofDays(30);

    private final JdbcTemplate jdbc;
    private final AttachmentRepository attachments;
    private final R2StorageService storage;

    @Scheduled(cron = "${investment.transaction-import.retention-cron:0 20 2 * * *}",
        zone = "${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    public void purgeExpiredStorage() {
        Instant now = Instant.now();
        Instant cutoff = now.minus(RETENTION);
        // Receipts finished (confirmed, or failed/cancelled) 30+ days ago with nothing left to review.
        List<Long> attachmentIds = jdbc.queryForList("""
            select a.id from attachments a
            where a.module = 'investment' and a.document_type = 'RECEIPT' and a.deleted_at is null
              and a.storage_purged_at is null
              and ((a.ai_status = 'CONFIRMED' and a.ai_confirmed_at <= ?)
                or (a.ai_status in ('FAILED', 'CANCELLED') and a.ai_completed_at <= ?))
              and not exists (select 1 from investment_transaction_import_item_sources s
                              join investment_transaction_import_items i on i.id = s.import_item_id
                              where s.attachment_id = a.id and i.deleted_at is null
                                and i.confirmed_transaction_id is null
                                and (i.resolution is null or i.resolution <> 'SKIP'))
            """, Long.class, Timestamp.from(cutoff), Timestamp.from(cutoff));
        for (Long attachmentId : attachmentIds) {
            purgeOne(attachmentId, now);
        }
    }

    public void purgeOne(Long attachmentId, Instant purgedAt) {
        Attachment attachment = attachments.findById(attachmentId).orElse(null);
        if (attachment == null || attachment.getStoragePurgedAt() != null) return;
        try {
            storage.delete(attachment.getR2AccountId(), attachment.getStorageKey());
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

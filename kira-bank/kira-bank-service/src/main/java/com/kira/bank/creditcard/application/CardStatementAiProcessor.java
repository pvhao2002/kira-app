package com.kira.bank.creditcard.application;

import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.creditcard.application.CardStatementImportService.ClaimedImport;
import com.kira.bank.creditcard.application.CardStatementImportService.ClaimedPage;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Runs the AI call for one claimed statement import outside any database transaction, then records the outcome.
 * Never logs image contents or extracted financial values.
 */
@Component
@RequiredArgsConstructor
public class CardStatementAiProcessor {
    private static final Logger log = LoggerFactory.getLogger(CardStatementAiProcessor.class);

    private final CardStatementImportService imports;
    private final R2StorageService storage;
    private final AiDocumentService ai;
    private final MeterRegistry metrics;

    public void process(ClaimedImport claimed) {
        try {
            if (claimed.pages().isEmpty()) {
                imports.markRetryOrFailed(claimed.importId(), "ATTACHMENT_MISSING");
                return;
            }
            List<AiDocumentService.AiInputDocument> pages = new ArrayList<>();
            for (ClaimedPage page : claimed.pages()) {
                try {
                    pages.add(new AiDocumentService.AiInputDocument(page.attachmentId(), page.mimeType(),
                        storage.download(page.r2AccountId(), page.storageKey())));
                } catch (RuntimeException ex) {
                    metrics.counter("credit_card.statement_import.ai.failure", "reason", "storage").increment();
                    log.warn("Unable to read statement import {} page {} for AI processing",
                        claimed.importId(), page.attachmentId());
                    imports.markRetryOrFailed(claimed.importId(), "ATTACHMENT_STORAGE_UNAVAILABLE");
                    return;
                }
            }
            AiDocumentService.AiCardStatementResponse response =
                ai.analyzeCardStatement(pages, claimed.categoryNames());
            imports.markReady(claimed.importId(), response.extraction(), response.model());
            log.info("Credit card statement import {} analyzed ({} page(s))", claimed.importId(), pages.size());
        } catch (AiDocumentService.AiProviderException ex) {
            metrics.counter("credit_card.statement_import.ai.failure", "reason", "provider").increment();
            log.warn("Cloudflare AI failed for statement import {}: {}", claimed.importId(), ex.getMessage());
            imports.markRetryOrFailed(claimed.importId(), "AI_PROVIDER_ERROR");
        } catch (RuntimeException ex) {
            metrics.counter("credit_card.statement_import.ai.failure", "reason", "unexpected").increment();
            log.error("Unexpected failure while processing statement import {}", claimed.importId(), ex);
            try {
                imports.markRetryOrFailed(claimed.importId(), "AI_PROCESSING_ERROR");
            } catch (RuntimeException recovery) {
                log.error("Unable to record failure for statement import {}", claimed.importId(), recovery);
            }
        }
    }
}

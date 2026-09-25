package com.kira.bank.creditcard.application;

import com.kira.bank.ai.AiDocumentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;

/**
 * Starts AI processing right after an import is queued. When AI is not configured or all run slots are busy the
 * import simply stays QUEUED and {@link CardStatementImportScheduler} picks it up later.
 */
@Component
public class CardStatementImportRunner {
    public static final int MAX_CONCURRENT_RUNS = 2;
    private static final Logger log = LoggerFactory.getLogger(CardStatementImportRunner.class);

    private final CardStatementImportService imports;
    private final CardStatementAiProcessor processor;
    private final AiDocumentService ai;
    private final ExecutorService executor;
    private final Semaphore capacity = new Semaphore(MAX_CONCURRENT_RUNS, true);

    public CardStatementImportRunner(CardStatementImportService imports, CardStatementAiProcessor processor,
                                     AiDocumentService ai,
                                     @Qualifier("cardStatementAiRunExecutor") ExecutorService executor) {
        this.imports = imports;
        this.processor = processor;
        this.ai = ai;
        this.executor = executor;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onQueued(CardStatementImportService.ImportQueuedEvent event) {
        if (!capacity.tryAcquire()) {
            return; // The scheduler will process it.
        }
        try {
            executor.execute(() -> {
                try {
                    if (ai.isConfigured()) {
                        imports.claim(event.importId()).ifPresent(processor::process);
                    }
                } catch (RuntimeException ex) {
                    log.warn("Immediate run of statement import {} failed to start", event.importId());
                } finally {
                    capacity.release();
                }
            });
        } catch (RejectedExecutionException ex) {
            capacity.release();
        }
    }
}

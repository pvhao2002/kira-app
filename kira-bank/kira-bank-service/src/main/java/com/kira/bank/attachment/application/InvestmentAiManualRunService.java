package com.kira.bank.attachment.application;

import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.attachment.config.InvestmentAiRunConfiguration;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.investment.application.InvestmentTransactionImportService;
import com.kira.bank.shared.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;

import static com.kira.bank.attachment.application.AttachmentDtos.InvestmentAiJobResponse;
import static com.kira.bank.attachment.application.InvestmentAiJobService.ImmediateRunClaim;

@Service
public class InvestmentAiManualRunService {
    private static final Logger log = LoggerFactory.getLogger(InvestmentAiManualRunService.class);

    private final InvestmentAiJobService jobs;
    private final InvestmentReceiptAiScheduler processor;
    private final AttachmentService attachments;
    private final InvestmentTransactionImportService transactionImports;
    private final AiDocumentService ai;
    private final ExecutorService executor;
    private final Semaphore capacity = new Semaphore(InvestmentAiRunConfiguration.MAX_CONCURRENT_RUNS, true);

    public InvestmentAiManualRunService(
        InvestmentAiJobService jobs,
        InvestmentReceiptAiScheduler processor,
        AttachmentService attachments,
        InvestmentTransactionImportService transactionImports,
        AiDocumentService ai,
        @Qualifier("investmentAiRunExecutor") ExecutorService executor
    ) {
        this.jobs = jobs;
        this.processor = processor;
        this.attachments = attachments;
        this.transactionImports = transactionImports;
        this.ai = ai;
        this.executor = executor;
    }

    public InvestmentAiJobResponse runMine(Long userId, Long attachmentId) {
        return runNow(attachmentId, () -> jobs.claimRunMine(userId, attachmentId));
    }

    public InvestmentAiJobResponse runAsAdmin(Long adminId, Long attachmentId) {
        return runNow(attachmentId, () -> jobs.claimRunAsAdmin(adminId, attachmentId));
    }

    private InvestmentAiJobResponse runNow(Long attachmentId, Supplier<ImmediateRunClaim> claimSupplier) {
        if (!ai.isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                "AI provider chưa được cấu hình");
        }
        if (!capacity.tryAcquire()) {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.RETRY_AFTER, "5");
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_RUN_CAPACITY_EXCEEDED",
                "Đang có quá nhiều AI job chạy thủ công", headers);
        }

        CompletableFuture<Attachment> claimedAttachment = new CompletableFuture<>();
        try {
            executor.execute(() -> processWhenClaimed(attachmentId, claimedAttachment));
        } catch (RejectedExecutionException ex) {
            capacity.release();
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_RUN_EXECUTOR_UNAVAILABLE",
                "Không thể khởi chạy AI job lúc này");
        }

        try {
            ImmediateRunClaim claim = claimSupplier.get();
            claimedAttachment.complete(claim.attachment());
            return claim.response();
        } catch (RuntimeException ex) {
            claimedAttachment.completeExceptionally(ex);
            throw ex;
        }
    }

    private void processWhenClaimed(Long attachmentId, CompletableFuture<Attachment> claimedAttachment) {
        try {
            Attachment attachment = claimedAttachment.join();
            processor.processClaimedAttachments(List.of(attachment));
        } catch (CompletionException ex) {
            log.debug("Manual AI run {} stopped before the attachment was claimed", attachmentId);
        } catch (RuntimeException ex) {
            log.error("Unexpected failure while manually running investment AI job {}", attachmentId, ex);
            recoverUnexpectedFailure(attachmentId);
        } finally {
            capacity.release();
        }
    }

    private void recoverUnexpectedFailure(Long attachmentId) {
        try {
            attachments.markRetryOrFailed(attachmentId, "AI_MANUAL_RUN_ERROR");
            transactionImports.refreshAttachmentState(attachmentId);
        } catch (RuntimeException recoveryFailure) {
            log.error("Unable to recover manual investment AI job {} after an unexpected failure",
                attachmentId, recoveryFailure);
        }
    }
}

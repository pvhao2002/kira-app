package com.kira.bank.investment.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.attachment.application.AttachmentDtos;
import com.kira.bank.attachment.application.AttachmentService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.investment.domain.*;
import com.kira.bank.investment.infrastructure.*;
import com.kira.bank.shared.web.ApiException;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import static com.kira.bank.investment.application.InvestmentTransactionDeduplicationService.Candidate;
import static com.kira.bank.investment.application.InvestmentTransactionImportDtos.*;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
public class InvestmentTransactionImportService {
    private static final Logger log = LoggerFactory.getLogger(InvestmentTransactionImportService.class);
    private static final int MAX_FILES = 10;
    private static final long MAX_BATCH_BYTES = 50L * 1024 * 1024;
    private static final Duration RETENTION = Duration.ofDays(30);

    private final InvestmentAccountRepository accounts;
    private final InvestmentAccountTransactionRepository transactions;
    private final InvestmentTransactionImportBatchRepository batches;
    private final InvestmentTransactionImportFileRepository files;
    private final InvestmentTransactionImportItemRepository items;
    private final AttachmentRepository attachmentRepository;
    private final AttachmentService attachmentService;
    private final AiDocumentService ai;
    private final UserRepository users;
    private final InvestmentTransactionNormalizationService normalization;
    private final InvestmentTransactionDeduplicationService deduplication;
    private final InvestmentTransactionItemConfirmationService confirmation;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final MeterRegistry metrics;
    private final EntityManager entityManager;
    @Value("${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    private String transactionImportTimeZone;

    @Transactional
    public ImportBatchResponse createBatch(Long userId, Long accountId, List<MultipartFile> uploads) throws IOException {
        if (!ai.isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                "AI import chưa được cấu hình");
        }
        InvestmentAccount account = account(accountId, userId);
        validateBatch(uploads);
        users.findByIdForUpdate(userId).orElseThrow();
        if (batches.countByUserIdAndCreatedAtGreaterThanEqualAndDeletedAtIsNull(
            userId, Instant.now().minusSeconds(60)) >= 5) {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.RETRY_AFTER, "60");
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "IMPORT_RATE_LIMITED",
                "Bạn đã vượt quá 5 batch trong một phút", headers);
        }

        InvestmentTransactionImportBatch batch = new InvestmentTransactionImportBatch();
        batch.setBatchId(UUID.randomUUID().toString());
        batch.setUserId(userId);
        batch.setInvestmentAccountId(accountId);
        batch.setStatus(InvestmentImportBatchStatus.QUEUED);
        batch.setFileCount(0);
        batch.setCreatedBy(userId);
        batch.setUpdatedBy(userId);
        batches.saveAndFlush(batch);

        Set<Long> linkedAttachments = new HashSet<>();
        for (MultipartFile upload : uploads) {
            AttachmentDtos.AttachmentResponse attachment = attachmentService.upload(
                userId, AttachmentService.INVESTMENT_MODULE, AttachmentService.RECEIPT_DOCUMENT_TYPE, upload);
            if (!linkedAttachments.add(attachment.attachmentId())) continue;
            InvestmentTransactionImportFile file = new InvestmentTransactionImportFile();
            file.setBatchId(batch.getId());
            file.setAttachmentId(attachment.attachmentId());
            file.setStatus(isReady(attachment.aiStatus()) ? InvestmentImportFileStatus.READY : InvestmentImportFileStatus.PENDING);
            file.setCreatedBy(userId);
            file.setUpdatedBy(userId);
            files.save(file);
            if (isReady(attachment.aiStatus()) && attachment.draft() != null) {
                createItems(batch, account, attachment.attachmentId(), attachment.draft());
            }
        }
        batch.setFileCount(linkedAttachments.size());
        refreshBatch(batch);
        metrics.counter("investment.import.batch.created").increment();
        log.info("Investment import queued batchId={} userId={} accountId={} numberOfImages={}",
            batch.getBatchId(), userId, accountId, uploads.size());
        return response(batch);
    }

    @Transactional(readOnly = true)
    public ImportBatchResponse batch(Long userId, Long accountId, String batchId) {
        account(accountId, userId);
        return response(ownedBatch(batchId, userId, accountId));
    }

    @Transactional
    public void refreshAttachmentState(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId).orElse(null);
        if (attachment == null) return;
        List<InvestmentTransactionImportFile> linked = files.findByAttachmentIdAndStatusInAndDeletedAtIsNull(
            attachmentId, List.of(InvestmentImportFileStatus.PENDING, InvestmentImportFileStatus.PROCESSING,
                InvestmentImportFileStatus.FAILED, InvestmentImportFileStatus.CANCELLED));
        for (InvestmentTransactionImportFile file : linked) {
            InvestmentTransactionImportBatch batch = batches.findById(file.getBatchId()).orElse(null);
            if (batch == null) continue;
            if (attachment.getAiStatus() == AttachmentAiStatus.READY || attachment.getAiStatus() == AttachmentAiStatus.CONFIRMED) {
                file.setStatus(InvestmentImportFileStatus.READY);
                file.setErrorCode(null);
                AttachmentDtos.AiDraftResponse draft = parseDraft(attachment.getAiResult());
                if (draft != null && items.findByBatchIdAndPrimaryAttachmentIdAndDeletedAtIsNull(
                    batch.getId(), attachmentId).isEmpty()) {
                    createItems(batch, account(batch.getInvestmentAccountId(), batch.getUserId()), attachmentId, draft);
                }
            } else if (attachment.getAiStatus() == AttachmentAiStatus.FAILED) {
                file.setStatus(InvestmentImportFileStatus.FAILED);
                file.setErrorCode(attachment.getAiError());
            } else if (attachment.getAiStatus() == AttachmentAiStatus.CANCELLED) {
                file.setStatus(InvestmentImportFileStatus.CANCELLED);
                file.setErrorCode(null);
            } else if (attachment.getAiStatus() == AttachmentAiStatus.PROCESSING) {
                file.setStatus(InvestmentImportFileStatus.PROCESSING);
                file.setErrorCode(null);
            } else if (attachment.getAiStatus() == AttachmentAiStatus.PENDING) {
                file.setStatus(InvestmentImportFileStatus.PENDING);
                file.setErrorCode(null);
            }
            refreshBatch(batch);
        }
    }

    @Transactional
    public ImportBatchResponse retryFile(Long userId, Long accountId, String batchId, Long attachmentId) {
        InvestmentTransactionImportBatch batch = ownedBatchForUpdate(batchId, userId, accountId);
        if (batch.getStatus() == InvestmentImportBatchStatus.CONFIRMED) {
            throw bad("IMPORT_BATCH_COMPLETED", "Batch đã hoàn tất");
        }
        InvestmentTransactionImportFile file = files.findByBatchIdAndAttachmentIdAndDeletedAtIsNull(
            batch.getId(), attachmentId).orElseThrow(() -> missing("IMPORT_FILE_NOT_FOUND"));
        attachmentService.retry(userId, attachmentId);
        file.setStatus(InvestmentImportFileStatus.PENDING);
        file.setErrorCode(null);
        batch.setCompletedAt(null);
        batch.setRetentionUntil(null);
        refreshBatch(batch);
        return response(batch);
    }

    @Transactional
    public ConfirmBatchResponse confirm(Long userId, Long accountId, String batchId, ConfirmBatchRequest request) {
        InvestmentTransactionImportBatch batch = ownedBatch(batchId, userId, accountId);
        if (!EnumSet.of(InvestmentImportBatchStatus.READY, InvestmentImportBatchStatus.READY_WITH_ERRORS,
            InvestmentImportBatchStatus.PARTIALLY_CONFIRMED).contains(batch.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "IMPORT_BATCH_NOT_REVIEWABLE",
                "Batch chưa sẵn sàng để xác nhận");
        }
        List<ConfirmItemResult> results = new ArrayList<>();
        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        for (ConfirmItemRequest item : request.transactions()) {
            try {
                ConfirmItemResult result = confirmation.confirmOne(userId, accountId, batch.getId(), item);
                results.add(result);
                switch (result.result()) {
                    case "INSERTED" -> inserted++;
                    case "UPDATED" -> updated++;
                    case "SKIPPED" -> skipped++;
                    default -> failed++;
                }
            } catch (DataIntegrityViolationException concurrentDuplicate) {
                try {
                    ConfirmItemResult result = confirmation.confirmOne(userId, accountId, batch.getId(), item);
                    results.add(result);
                    if ("UPDATED".equals(result.result())) updated++;
                    else skipped++;
                } catch (RuntimeException reconcileFailure) {
                    failed++;
                    String code = reconcileFailure instanceof ApiException apiException
                        ? apiException.getCode() : "IMPORT_CONCURRENT_CONFIRM_FAILED";
                    results.add(new ConfirmItemResult(item.itemId(), "FAILED", null, code));
                    log.warn("Concurrent investment import reconcile failed batchId={} itemId={} code={}",
                        batchId, item.itemId(), code);
                }
            } catch (RuntimeException ex) {
                failed++;
                String code = ex instanceof ApiException apiException ? apiException.getCode() : "IMPORT_ITEM_FAILED";
                results.add(new ConfirmItemResult(item.itemId(), "FAILED", null, code));
                log.warn("Investment import item failed batchId={} itemId={} code={}", batchId, item.itemId(), code);
            }
        }
        // confirmOne runs in independent transactions. Another request may have finalized this
        // batch while this transaction was suspended, so discard the stale managed version
        // before acquiring the batch write lock and recomputing its counters.
        entityManager.clear();
        finalizeBatch(userId, accountId, batchId, inserted, updated, skipped, failed);
        metrics.counter("investment.import.confirm", "result", failed == 0 ? "success" : "partial").increment();
        results.forEach(result -> metrics.counter("investment.import.confirm.item", "result",
            result.result().toLowerCase(Locale.ROOT)).increment());
        return new ConfirmBatchResponse(inserted, updated, skipped, failed, List.copyOf(results));
    }

    @Transactional
    public void finalizeBatch(Long userId, Long accountId, String batchId,
                              int inserted, int updated, int skipped, int failed) {
        InvestmentTransactionImportBatch batch = ownedBatchForUpdate(batchId, userId, accountId);
        List<InvestmentTransactionImportItem> batchItems = items.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId());
        batch.setInsertedCount((int) batchItems.stream().filter(item -> item.getConfirmedTransactionId() != null
            && item.getProcessingAction() == InvestmentProcessingAction.INSERT).count());
        batch.setUpdatedCount((int) batchItems.stream().filter(item -> item.getConfirmedTransactionId() != null
            && item.getProcessingAction() == InvestmentProcessingAction.UPDATE).count());
        batch.setSkippedCount((int) batchItems.stream().filter(item -> item.getResolution() == InvestmentImportResolution.SKIP
            || (item.getConfirmedTransactionId() != null
            && item.getProcessingAction() == InvestmentProcessingAction.DUPLICATE)).count());
        batch.setFailedCount(failed);
        long unresolvedReview = batchItems.stream().filter(item -> item.getConfirmedTransactionId() == null
            && item.getResolution() != InvestmentImportResolution.SKIP
            && item.getProcessingAction() == InvestmentProcessingAction.REVIEW).count();
        long unresolvedItems = batchItems.stream().filter(item -> item.getConfirmedTransactionId() == null
            && item.getResolution() != InvestmentImportResolution.SKIP).count();
        batch.setReviewCount((int) unresolvedReview);
        boolean fileFailure = files.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId()).stream()
            .anyMatch(file -> file.getStatus() == InvestmentImportFileStatus.FAILED);
        batch.setStatus(unresolvedItems == 0 && failed == 0 && !fileFailure
            ? InvestmentImportBatchStatus.CONFIRMED : InvestmentImportBatchStatus.PARTIALLY_CONFIRMED);
        if (batch.getStatus() == InvestmentImportBatchStatus.CONFIRMED) {
            batch.setCompletedAt(Instant.now());
            batch.setRetentionUntil(Instant.now().plus(RETENTION));
            for (InvestmentTransactionImportFile file : files.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId())) {
                if (file.getStatus() == InvestmentImportFileStatus.READY) {
                    attachmentService.markConfirmed(userId, file.getAttachmentId());
                    file.setStatus(InvestmentImportFileStatus.CONFIRMED);
                }
            }
        }
        log.info("Investment import confirmed batchId={} userId={} accountId={} inserted={} updated={} skipped={} failed={}",
            batchId, userId, accountId, inserted, updated, skipped, failed);
    }

    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> transactions(Long userId, Long accountId, LocalDate fromDate,
                                                          LocalDate toDate, InvestmentTransactionType type,
                                                          InvestmentTransactionStatus status, Pageable pageable) {
        account(accountId, userId);
        ZoneId zone = ZoneId.of(transactionImportTimeZone);
        Instant from = fromDate == null ? null : fromDate.atStartOfDay(zone).toInstant();
        Instant to = toDate == null ? null : toDate.plusDays(1).atStartOfDay(zone).toInstant();
        Page<TransactionResponse> page = transactions.search(userId, accountId, from, to, type, status, pageable)
            .map(this::transactionResponse);
        return new PageResponse<>(page.getContent(), new PageMeta(
            page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    private void createItems(InvestmentTransactionImportBatch batch, InvestmentAccount account, Long attachmentId,
                             AttachmentDtos.AiDraftResponse draft) {
        if (draft.transactions() == null) return;
        for (AttachmentDtos.AiTransactionDraftResponse raw : draft.transactions()) {
            InvestmentTransactionImportItem item = toItem(batch, account, attachmentId, raw);
            InvestmentTransactionImportItem merged = mergeCandidate(batch, item);
            if (merged == null) {
                items.saveAndFlush(item);
                linkSource(item.getId(), attachmentId);
            } else {
                linkSource(merged.getId(), attachmentId);
            }
        }
    }

    private InvestmentTransactionImportItem toItem(InvestmentTransactionImportBatch batch, InvestmentAccount account,
                                                    Long attachmentId, AttachmentDtos.AiTransactionDraftResponse raw) {
        InvestmentTransactionImportItem item = new InvestmentTransactionImportItem();
        item.setItemId(UUID.randomUUID().toString());
        item.setBatchId(batch.getId());
        item.setPrimaryAttachmentId(attachmentId);
        item.setTransactionType(enumValue(InvestmentTransactionType.class, raw.transactionType()));
        item.setTransactionStatus(enumValue(InvestmentTransactionStatus.class, raw.transactionStatus()));
        item.setAmount(normalization.amount(raw.amount()));
        List<String> warnings = new ArrayList<>(raw.validationWarnings() == null
            ? List.of() : raw.validationWarnings());
        String currency = normalization.currency(raw.currency());
        if (currency == null) {
            currency = account.getCurrency();
            warnings.add("CURRENCY_INFERRED_FROM_ACCOUNT");
        }
        item.setCurrency(currency);
        item.setTransactionAt(raw.transactionAt());
        item.setExternalTransactionId(normalization.externalId(raw.externalTransactionId()));
        item.setDescription(trim(raw.description()));
        item.setNormalizedDescription(normalization.description(raw.description()));
        item.setRawText(raw.rawText());
        item.setAiConfidence(raw.confidence() == null ? null : BigDecimal.valueOf(raw.confidence()));
        item.setAiExtractionData(json(raw));
        Candidate candidate = candidate(item, account, warnings);
        var decision = deduplication.decide(candidate, false);
        item.setProcessingAction(decision.action());
        item.setMatchedTransactionId(decision.matchedTransactionId());
        item.setDeduplicationKey(decision.deduplicationKey());
        item.setWarnings(json(decision.warnings()));
        item.setCreatedBy(batch.getUserId());
        item.setUpdatedBy(batch.getUserId());
        metrics.counter("investment.import.item", "action", decision.action().name().toLowerCase(Locale.ROOT)).increment();
        if (decision.action() == InvestmentProcessingAction.REVIEW) {
            metrics.counter("investment.import.review.required").increment();
        }
        if (decision.action() == InvestmentProcessingAction.DUPLICATE) {
            metrics.counter("investment.import.duplicate").increment();
        }
        return item;
    }

    private InvestmentTransactionImportItem mergeCandidate(InvestmentTransactionImportBatch batch,
                                                            InvestmentTransactionImportItem incoming) {
        for (InvestmentTransactionImportItem existing : items.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId())) {
            boolean sameExternal = incoming.getExternalTransactionId() != null
                && incoming.getExternalTransactionId().equals(existing.getExternalTransactionId());
            boolean sameKey = incoming.getDeduplicationKey() != null && existing.getDeduplicationKey() != null
                && Arrays.equals(incoming.getDeduplicationKey(), existing.getDeduplicationKey());
            if (!sameExternal && !sameKey) continue;
            List<String> warnings = new ArrayList<>(warnings(existing.getWarnings()));
            if (!Objects.equals(existing.getTransactionType(), incoming.getTransactionType())) warnings.add("TYPE_CONFLICT");
            if (existing.getAmount() != null && incoming.getAmount() != null
                && existing.getAmount().compareTo(incoming.getAmount()) != 0) warnings.add("AMOUNT_CONFLICT");
            if (!Objects.equals(existing.getCurrency(), incoming.getCurrency())) warnings.add("CURRENCY_CONFLICT");
            if (hasConflict(warnings) || incoming.getExternalTransactionId() == null) {
                if (incoming.getExternalTransactionId() == null) warnings.add("FALLBACK_DEDUP_COLLISION");
                existing.setProcessingAction(InvestmentProcessingAction.REVIEW);
            } else if (existing.getTransactionStatus() == InvestmentTransactionStatus.PENDING
                && incoming.getTransactionStatus() != null && incoming.getTransactionStatus().terminal()) {
                existing.setTransactionStatus(incoming.getTransactionStatus());
                existing.setTransactionAt(incoming.getTransactionAt());
                existing.setProcessingAction(incoming.getProcessingAction());
                existing.setDescription(prefer(existing.getDescription(), incoming.getDescription()));
                existing.setRawText(prefer(existing.getRawText(), incoming.getRawText()));
                existing.setAiConfidence(max(existing.getAiConfidence(), incoming.getAiConfidence()));
            } else if (existing.getTransactionStatus() != null && incoming.getTransactionStatus() != null
                && existing.getTransactionStatus().terminal() && incoming.getTransactionStatus().terminal()
                && existing.getTransactionStatus() != incoming.getTransactionStatus()) {
                warnings.add("STATUS_CONFLICT");
                existing.setProcessingAction(InvestmentProcessingAction.REVIEW);
            }
            existing.setWarnings(json(warnings.stream().distinct().toList()));
            return existing;
        }
        return null;
    }

    private void refreshBatch(InvestmentTransactionImportBatch batch) {
        List<InvestmentTransactionImportFile> batchFiles = files.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId());
        boolean processing = batchFiles.stream()
            .anyMatch(file -> file.getStatus() == InvestmentImportFileStatus.PROCESSING);
        boolean pending = batchFiles.stream()
            .anyMatch(file -> file.getStatus() == InvestmentImportFileStatus.PENDING);
        long failed = batchFiles.stream().filter(file -> file.getStatus() == InvestmentImportFileStatus.FAILED).count();
        long cancelled = batchFiles.stream().filter(file -> file.getStatus() == InvestmentImportFileStatus.CANCELLED).count();
        if (processing) batch.setStatus(InvestmentImportBatchStatus.PROCESSING);
        else if (pending) batch.setStatus(InvestmentImportBatchStatus.QUEUED);
        else if (!batchFiles.isEmpty() && cancelled == batchFiles.size()) batch.setStatus(InvestmentImportBatchStatus.CANCELLED);
        else if (!batchFiles.isEmpty() && failed + cancelled == batchFiles.size()) batch.setStatus(InvestmentImportBatchStatus.FAILED);
        else if (failed + cancelled > 0) batch.setStatus(InvestmentImportBatchStatus.READY_WITH_ERRORS);
        else batch.setStatus(InvestmentImportBatchStatus.READY);
        List<InvestmentTransactionImportItem> batchItems = items.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId());
        batch.setDetectedCount(batchItems.size());
        batch.setReviewCount((int) batchItems.stream()
            .filter(item -> item.getProcessingAction() == InvestmentProcessingAction.REVIEW).count());
        batch.setFailedCount((int) failed);
        if (List.of(InvestmentImportBatchStatus.QUEUED, InvestmentImportBatchStatus.PROCESSING).contains(batch.getStatus())) {
            batch.setCompletedAt(null);
            batch.setRetentionUntil(null);
        } else if (List.of(InvestmentImportBatchStatus.FAILED, InvestmentImportBatchStatus.CANCELLED)
            .contains(batch.getStatus()) && batch.getCompletedAt() == null) {
            batch.setCompletedAt(Instant.now());
            batch.setRetentionUntil(Instant.now().plus(RETENTION));
        }
    }

    private ImportBatchResponse response(InvestmentTransactionImportBatch batch) {
        List<ImportFileResponse> fileResponses = files.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId()).stream()
            .map(file -> {
                Attachment attachment = attachmentRepository.findById(file.getAttachmentId()).orElseThrow();
                return new ImportFileResponse(attachment.getId(), attachment.getOriginalName(),
                    "/api/v1/attachments/" + attachment.getId() + "/content", file.getStatus(), file.getErrorCode());
            }).toList();
        List<ImportItemResponse> itemResponses = items.findByBatchIdAndDeletedAtIsNullOrderById(batch.getId()).stream()
            .map(this::itemResponse).toList();
        return new ImportBatchResponse(batch.getBatchId(), batch.getInvestmentAccountId(), batch.getStatus(),
            new BatchSummary(batch.getDetectedCount(), batch.getInsertedCount(), batch.getUpdatedCount(),
                batch.getSkippedCount(), batch.getFailedCount(), batch.getReviewCount()), fileResponses, itemResponses);
    }

    private ImportItemResponse itemResponse(InvestmentTransactionImportItem item) {
        return new ImportItemResponse(item.getItemId(), item.getVersion(), item.getTransactionType(),
            item.getTransactionStatus(), item.getAmount(), item.getCurrency(), item.getTransactionAt(),
            item.getExternalTransactionId(), item.getDescription(), item.getRawText(), item.getAiConfidence(),
            item.getProcessingAction(), item.getMatchedTransactionId(), warnings(item.getWarnings()));
    }

    private TransactionResponse transactionResponse(InvestmentAccountTransaction transaction) {
        return new TransactionResponse(transaction.getId(), transaction.getTransactionType(),
            transaction.getTransactionStatus(), transaction.getAmount(), transaction.getCurrency(),
            transaction.getTransactionAt(), transaction.getExternalTransactionId(), transaction.getDescription(),
            transaction.getRawText(), transaction.getAiConfidence(), transaction.getSourceFileHash(), transaction.getVersion());
    }

    private Candidate candidate(InvestmentTransactionImportItem item, InvestmentAccount account, List<String> warnings) {
        return new Candidate(item.getItemId(), account.getId(), account.getCurrency(), item.getTransactionType(),
            item.getTransactionStatus(), item.getAmount(), item.getCurrency(), item.getTransactionAt(),
            item.getExternalTransactionId(), item.getAiConfidence(), warnings);
    }

    private void validateBatch(List<MultipartFile> uploads) {
        if (uploads == null || uploads.isEmpty() || uploads.size() > MAX_FILES) {
            throw bad("INVALID_IMPORT_FILE_COUNT", "Mỗi batch phải có từ 1 đến 10 ảnh");
        }
        long total = uploads.stream().mapToLong(MultipartFile::getSize).sum();
        if (total > MAX_BATCH_BYTES) throw bad("IMPORT_BATCH_TOO_LARGE", "Tổng dung lượng batch không được vượt 50 MB");
    }

    private boolean isReady(AttachmentAiStatus status) {
        return status == AttachmentAiStatus.READY || status == AttachmentAiStatus.CONFIRMED;
    }

    private InvestmentAccount account(Long accountId, Long userId) {
        return accounts.findByIdAndUserIdAndDeletedAtIsNull(accountId, userId)
            .orElseThrow(() -> missing("INVESTMENT_ACCOUNT_NOT_FOUND"));
    }

    private InvestmentTransactionImportBatch ownedBatch(String batchId, Long userId, Long accountId) {
        return batches.findByBatchIdAndUserIdAndInvestmentAccountIdAndDeletedAtIsNull(batchId, userId, accountId)
            .orElseThrow(() -> missing("IMPORT_BATCH_NOT_FOUND"));
    }

    private InvestmentTransactionImportBatch ownedBatchForUpdate(String batchId, Long userId, Long accountId) {
        return batches.findOwnedForUpdate(batchId, userId, accountId)
            .orElseThrow(() -> missing("IMPORT_BATCH_NOT_FOUND"));
    }

    private void linkSource(Long itemId, Long attachmentId) {
        jdbc.update("INSERT IGNORE INTO investment_transaction_import_item_sources(import_item_id, attachment_id) VALUES (?, ?)",
            itemId, attachmentId);
    }

    private AttachmentDtos.AiDraftResponse parseDraft(String json) {
        try {
            return json == null ? null : objectMapper.readValue(json, AttachmentDtos.AiDraftResponse.class);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize investment import data", ex);
        }
    }

    private List<String> warnings(String value) {
        try {
            return value == null ? new ArrayList<>() : objectMapper.readValue(value, new TypeReference<>() {});
        } catch (JsonProcessingException ex) {
            return new ArrayList<>(List.of("INVALID_STORED_WARNINGS"));
        }
    }

    private boolean hasConflict(List<String> warnings) {
        return warnings.stream().anyMatch(warning -> warning.endsWith("_CONFLICT"));
    }

    private String prefer(String first, String second) {
        return first == null || (second != null && second.length() > first.length()) ? second : first;
    }

    private BigDecimal max(BigDecimal first, BigDecimal second) {
        if (first == null) return second;
        if (second == null) return first;
        return first.max(second);
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private <E extends Enum<E>> E enumValue(Class<E> type, String value) {
        try {
            return value == null ? null : Enum.valueOf(type, value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private ApiException missing(String code) {
        return new ApiException(HttpStatus.NOT_FOUND, code, "Không tìm thấy dữ liệu");
    }
}

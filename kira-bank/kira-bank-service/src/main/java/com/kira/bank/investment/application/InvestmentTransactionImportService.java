package com.kira.bank.investment.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.attachment.application.AttachmentDtos;
import com.kira.bank.attachment.application.AttachmentService;
import com.kira.bank.attachment.application.InvestmentAiManualRunService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.investment.domain.*;
import com.kira.bank.investment.infrastructure.*;
import com.kira.bank.shared.web.ApiException;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

import static com.kira.bank.investment.application.InvestmentStatisticsDtos.DailyFlow;
import static com.kira.bank.investment.application.InvestmentStatisticsDtos.StatisticsResponse;
import static com.kira.bank.investment.application.InvestmentTransactionDeduplicationService.Candidate;
import static com.kira.bank.investment.application.InvestmentTransactionImportDtos.*;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
public class InvestmentTransactionImportService {
    private static final Logger log = LoggerFactory.getLogger(InvestmentTransactionImportService.class);
    private static final int MAX_FILES = 10;
    private static final long MAX_UPLOAD_BYTES = 50L * 1024 * 1024;
    private static final int MAX_IMAGES_PER_MINUTE = 30;
    // Auto-commit failures that a later sweep may still resolve; anything else needs a human decision.
    private static final Set<String> RETRYABLE_CODES = Set.of("IMPORT_ITEM_FAILED",
        "IMPORT_CONCURRENT_CONFIRM_FAILED", "IMPORT_ITEM_VERSION_CONFLICT", "IMPORT_ITEM_NOT_FOUND",
        "INVESTMENT_ACCOUNT_NOT_FOUND");

    private final InvestmentAccountRepository accounts;
    private final InvestmentAccountTransactionRepository transactions;
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
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactionTemplate;
    @Value("${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}")
    private String transactionImportTimeZone;

    /**
     * R2 uploads run before any DB transaction; the user lock, attachment and link rows are then written in one short
     * transaction so a PENDING receipt is never visible to the AI scheduler without its account link. Valid
     * transactions are recorded automatically once AI finished ({@link #processExtracted}); the rest wait for review.
     */
    public ImportStateResponse upload(Long userId, Long accountId, List<MultipartFile> uploads) throws IOException {
        if (!ai.isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                "AI import chưa được cấu hình");
        }
        account(accountId, userId);
        validateUploads(uploads);
        // Non-locking pre-check so a rate-limited request does not upload anything; re-checked under the lock below.
        checkRateLimit(userId, uploads.size());
        List<AttachmentService.PreparedUpload> prepared = new ArrayList<>(uploads.size());
        for (int index = 0; index < uploads.size(); index++) {
            prepared.add(attachmentService.store(userId, AttachmentService.INVESTMENT_MODULE,
                AttachmentService.RECEIPT_DOCUMENT_TYPE, uploads.get(index), index + 1));
        }
        List<Long> alreadyExtracted = new ArrayList<>();
        transactionTemplate.executeWithoutResult(status ->
            linkUploads(userId, accountId, uploads.size(), prepared, alreadyExtracted));
        for (Long attachmentId : alreadyExtracted) {
            try {
                processExtracted(attachmentId);
            } catch (RuntimeException ex) {
                log.warn("Investment import processing deferred attachmentId={} error={}",
                    attachmentId, ex.getClass().getSimpleName());
            }
        }
        return state(userId, accountId);
    }

    private void checkRateLimit(Long userId, int numberOfImages) {
        if (files.countRecentByUser(userId, Instant.now().minusSeconds(60)) + numberOfImages > MAX_IMAGES_PER_MINUTE) {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.RETRY_AFTER, "60");
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "IMPORT_RATE_LIMITED",
                "Bạn đã vượt quá " + MAX_IMAGES_PER_MINUTE + " ảnh trong một phút", headers);
        }
    }

    private void linkUploads(Long userId, Long accountId, int numberOfImages,
                             List<AttachmentService.PreparedUpload> prepared, List<Long> alreadyExtracted) {
        users.findByIdForUpdate(userId).orElseThrow();
        checkRateLimit(userId, numberOfImages);
        account(accountId, userId);
        List<Long> pending = new ArrayList<>();
        for (AttachmentService.PreparedUpload upload : prepared) {
            AttachmentDtos.AttachmentResponse attachment = attachmentService.record(userId, upload);
            if (files.findByInvestmentAccountIdAndAttachmentId(accountId, attachment.attachmentId()).isPresent()) continue;
            InvestmentTransactionImportFile link = new InvestmentTransactionImportFile();
            link.setInvestmentAccountId(accountId);
            link.setAttachmentId(attachment.attachmentId());
            link.setCreatedBy(userId);
            link.setUpdatedBy(userId);
            files.saveAndFlush(link);
            if (attachment.aiStatus() == AttachmentAiStatus.PENDING) pending.add(attachment.attachmentId());
            else if (isReady(attachment.aiStatus())) alreadyExtracted.add(attachment.attachmentId());
        }
        if (!pending.isEmpty()) events.publishEvent(new InvestmentAiManualRunService.ReceiptsQueued(pending));
        log.info("Investment import queued userId={} accountId={} numberOfImages={}", userId, accountId, numberOfImages);
    }

    @Transactional(readOnly = true)
    public ImportStateResponse state(Long userId, Long accountId) {
        account(accountId, userId);
        List<InvestmentTransactionImportFile> links =
            files.findTop20ByInvestmentAccountIdAndDeletedAtIsNullOrderByCreatedAtDesc(accountId);
        Map<Long, Attachment> attachmentsById = new HashMap<>();
        Map<Long, Long> committed = new HashMap<>();
        if (!links.isEmpty()) {
            List<Long> ids = links.stream().map(InvestmentTransactionImportFile::getAttachmentId).distinct().toList();
            attachmentRepository.findAllById(ids).forEach(attachment -> attachmentsById.put(attachment.getId(), attachment));
            List<Object> args = new ArrayList<>();
            args.add(accountId);
            args.addAll(ids);
            jdbc.query("""
                select primary_attachment_id, count(*) from investment_transaction_import_items
                where investment_account_id = ? and confirmed_transaction_id is not null and deleted_at is null
                  and processing_action in ('INSERT', 'UPDATE')
                  and primary_attachment_id in (%s)
                group by primary_attachment_id
                """.formatted(String.join(",", Collections.nCopies(ids.size(), "?"))),
                rs -> {
                    committed.put(rs.getLong(1), rs.getLong(2));
                }, args.toArray());
        }
        List<ImportFileResponse> fileResponses = links.stream()
            .filter(link -> attachmentsById.containsKey(link.getAttachmentId()))
            .map(link -> {
                Attachment attachment = attachmentsById.get(link.getAttachmentId());
                return new ImportFileResponse(attachment.getId(), attachment.getOriginalName(),
                    "/api/v1/attachments/" + attachment.getId() + "/content", attachment.getAiStatus(),
                    attachment.getAiError(), link.getCreatedAt(), committed.getOrDefault(attachment.getId(), 0L));
            }).toList();
        return new ImportStateResponse(accountId, fileResponses,
            items.findOpenByAccount(accountId).stream().map(this::itemResponse).toList());
    }

    /**
     * Creates review items for every unprocessed account link of a READY/CONFIRMED receipt, records the valid ones
     * automatically and marks the receipt CONFIRMED once nothing is left to review. Idempotent and redelivery-safe:
     * the link row (processedAt) guards item creation and confirmOne guards the ledger. Must NOT be called inside an
     * outer transaction because the per-item confirmations run in their own transactions.
     */
    public void processExtracted(Long attachmentId) {
        ExtractedLinks extracted = transactionTemplate.execute(status -> createPendingItems(attachmentId));
        if (extracted == null) return;
        for (Long accountId : extracted.accountIds()) {
            autoCommit(extracted.userId(), accountId);
        }
        markConfirmedIfResolved(attachmentId);
    }

    private record ExtractedLinks(Long userId, List<Long> accountIds) {
    }

    private ExtractedLinks createPendingItems(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId).orElse(null);
        if (attachment == null || !isReady(attachment.getAiStatus()) || attachment.getAiResult() == null) return null;
        Long userId = attachment.getUserId();
        users.findByIdForUpdate(userId).orElseThrow();
        AttachmentDtos.AiDraftResponse draft = parseDraft(attachment.getAiResult());
        List<Long> accountIds = new ArrayList<>();
        for (InvestmentTransactionImportFile link : files.findByAttachmentIdForUpdate(attachmentId)) {
            accountIds.add(link.getInvestmentAccountId());
            if (link.getProcessedAt() != null) continue;
            InvestmentAccount account = accounts.findByIdAndUserIdAndDeletedAtIsNull(
                link.getInvestmentAccountId(), userId).orElse(null);
            if (account != null && draft != null) createItems(account, attachmentId, draft, userId);
            link.setProcessedAt(Instant.now());
        }
        return new ExtractedLinks(userId, accountIds);
    }

    private void autoCommit(Long userId, Long accountId) {
        for (InvestmentTransactionImportItem item : items.findOpenByAccount(accountId)) {
            if (item.getProcessingAction() != InvestmentProcessingAction.INSERT
                && item.getProcessingAction() != InvestmentProcessingAction.UPDATE
                && item.getProcessingAction() != InvestmentProcessingAction.DUPLICATE) continue;
            ConfirmItemResult result = confirmWithRetry(userId, accountId, new ConfirmItemRequest(
                item.getItemId(), item.getVersion(), true, InvestmentImportResolution.ACCEPT,
                item.getTransactionType(), item.getTransactionStatus(), item.getAmount(), item.getCurrency(),
                item.getTransactionAt(), item.getExternalTransactionId(), item.getDescription()));
            if ("FAILED".equals(result.result()) && !RETRYABLE_CODES.contains(result.errorCode())) {
                // Needs a human decision (conflict, validation); retrying every sweep would not help.
                transactionTemplate.executeWithoutResult(status -> items.findForUpdate(item.getItemId(), accountId)
                    .filter(open -> open.getConfirmedTransactionId() == null)
                    .ifPresent(open -> {
                        open.setProcessingAction(InvestmentProcessingAction.REVIEW);
                        open.setUpdatedBy(userId);
                    }));
            }
        }
    }

    private ConfirmItemResult confirmWithRetry(Long userId, Long accountId, ConfirmItemRequest item) {
        try {
            return confirmation.confirmOne(userId, accountId, item);
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            try {
                return confirmation.confirmOne(userId, accountId, item);
            } catch (RuntimeException reconcileFailure) {
                String code = reconcileFailure instanceof ApiException apiException
                    ? apiException.getCode() : "IMPORT_CONCURRENT_CONFIRM_FAILED";
                log.warn("Concurrent investment import reconcile failed accountId={} itemId={} code={}",
                    accountId, item.itemId(), code);
                return new ConfirmItemResult(item.itemId(), "FAILED", null, code);
            }
        } catch (RuntimeException ex) {
            String code = ex instanceof ApiException apiException ? apiException.getCode() : "IMPORT_ITEM_FAILED";
            log.warn("Investment import item failed accountId={} itemId={} code={}", accountId, item.itemId(), code);
            return new ConfirmItemResult(item.itemId(), "FAILED", null, code);
        }
    }

    /** Marks the receipt CONFIRMED only when every account link was processed and no item is still open. */
    private void markConfirmedIfResolved(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId).orElse(null);
        if (attachment == null || attachment.getAiStatus() != AttachmentAiStatus.READY) return;
        Integer unprocessed = jdbc.queryForObject("""
            select count(*) from investment_transaction_import_files
            where attachment_id = ? and deleted_at is null and processed_at is null
            """, Integer.class, attachmentId);
        Integer open = jdbc.queryForObject("""
            select count(*) from investment_transaction_import_items i
              join investment_transaction_import_item_sources s on s.import_item_id = i.id
            where s.attachment_id = ? and i.deleted_at is null and i.confirmed_transaction_id is null
              and (i.resolution is null or i.resolution <> 'SKIP')
            """, Integer.class, attachmentId);
        if (unprocessed != null && unprocessed == 0 && open != null && open == 0) {
            try {
                attachmentService.markConfirmed(attachment.getUserId(), attachmentId);
            } catch (ApiException raced) {
                // Re-run or cancel changed the status meanwhile; nothing to confirm.
            }
        }
    }

    /** Sweep: finishes receipts whose items were never created or whose auto-commit was interrupted. */
    public void processUnfinished() {
        List<Long> attachmentIds = jdbc.queryForList("""
            select f.attachment_id from investment_transaction_import_files f
              join attachments a on a.id = f.attachment_id
            where f.deleted_at is null and f.processed_at is null and a.deleted_at is null
              and a.ai_status in ('READY', 'CONFIRMED')
            union
            select i.primary_attachment_id from investment_transaction_import_items i
            where i.deleted_at is null and i.confirmed_transaction_id is null and i.resolution is null
              and i.processing_action in ('INSERT', 'UPDATE', 'DUPLICATE')
            """, Long.class);
        for (Long attachmentId : attachmentIds) {
            try {
                processExtracted(attachmentId);
            } catch (RuntimeException ex) {
                log.warn("Investment import sweep failed attachmentId={} error={}",
                    attachmentId, ex.getClass().getSimpleName());
            }
        }
    }

    @Transactional
    public void resetForRerun(Long attachmentId) {
        Instant now = Instant.now();
        for (InvestmentTransactionImportItem item : items
            .findByPrimaryAttachmentIdAndConfirmedTransactionIdIsNullAndDeletedAtIsNull(attachmentId)) {
            item.setDeletedAt(now);
        }
        files.findByAttachmentIdForUpdate(attachmentId).forEach(link -> link.setProcessedAt(null));
    }

    /** Reviewed/manual confirmation. Runs without an outer transaction: confirmOne uses its own. */
    public ConfirmBatchResponse confirm(Long userId, Long accountId, ConfirmBatchRequest request) {
        account(accountId, userId);
        List<ConfirmItemResult> results = new ArrayList<>();
        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        for (ConfirmItemRequest item : request.transactions()) {
            ConfirmItemResult result = confirmWithRetry(userId, accountId, item);
            results.add(result);
            switch (result.result()) {
                case "INSERTED" -> inserted++;
                case "UPDATED" -> updated++;
                case "SKIPPED" -> skipped++;
                default -> failed++;
            }
        }
        List<Object> args = new ArrayList<>();
        args.add(accountId);
        request.transactions().forEach(item -> args.add(item.itemId()));
        jdbc.queryForList("""
            select distinct s.attachment_id from investment_transaction_import_item_sources s
              join investment_transaction_import_items i on i.id = s.import_item_id
            where i.investment_account_id = ? and i.item_id in (%s)
            """.formatted(String.join(",", Collections.nCopies(request.transactions().size(), "?"))),
            Long.class, args.toArray()).forEach(this::markConfirmedIfResolved);
        log.info("Investment import confirmed userId={} accountId={} inserted={} updated={} skipped={} failed={}",
            userId, accountId, inserted, updated, skipped, failed);
        metrics.counter("investment.import.confirm", "result", failed == 0 ? "success" : "partial").increment();
        results.forEach(result -> metrics.counter("investment.import.confirm.item", "result",
            result.result().toLowerCase(Locale.ROOT)).increment());
        return new ConfirmBatchResponse(inserted, updated, skipped, failed, List.copyOf(results));
    }

    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> transactions(Long userId, Long accountId, LocalDate fromDate,
                                                          LocalDate toDate, InvestmentTransactionType type,
                                                          InvestmentTransactionStatus status, boolean hideNoise,
                                                          Pageable pageable) {
        account(accountId, userId);
        ZoneId zone = ZoneId.of(transactionImportTimeZone);
        Instant from = fromDate == null ? null : fromDate.atStartOfDay(zone).toInstant();
        Instant to = toDate == null ? null : toDate.plusDays(1).atStartOfDay(zone).toInstant();
        Page<TransactionResponse> page = transactions.search(userId, accountId, from, to, type, status, hideNoise, pageable)
            .map(this::transactionResponse);
        return new PageResponse<>(page.getContent(), new PageMeta(
            page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public TransactionResponse transaction(Long userId, Long accountId, Long transactionId) {
        account(accountId, userId);
        InvestmentAccountTransaction transaction = transactions
            .findByIdAndUserIdAndInvestmentAccountIdAndDeletedAtIsNull(transactionId, userId, accountId)
            .orElseThrow(() -> missing("INVESTMENT_TRANSACTION_NOT_FOUND"));
        return transactionResponse(transaction);
    }

    @Transactional
    public void deleteTransaction(Long userId, Long accountId, Long transactionId) {
        account(accountId, userId);
        InvestmentAccountTransaction transaction = transactions
            .findByIdAndUserIdAndInvestmentAccountIdAndDeletedAtIsNull(transactionId, userId, accountId)
            .orElseThrow(() -> missing("INVESTMENT_TRANSACTION_NOT_FOUND"));
        if (transaction.getExternalTransactionId() != null) {
            throw bad("INVESTMENT_TRANSACTION_HAS_EXTERNAL_ID",
                "Chỉ có thể xoá giao dịch chưa xác định được mã tham chiếu");
        }
        transaction.setDeletedAt(Instant.now());
        transaction.setUpdatedBy(userId);
        metrics.counter("investment.transaction.deleted").increment();
    }

    @Transactional
    public TransactionResponse createManual(Long userId, Long accountId, ManualTransactionRequest request) {
        InvestmentAccount account = account(accountId, userId);
        InvestmentTransactionType type = request.transactionType();
        InvestmentTransactionStatus status = request.transactionStatus();
        BigDecimal amount = normalization.amount(request.amount());
        String currency = normalization.currency(request.currency());
        String externalId = normalization.externalId(request.externalTransactionId());
        String description = trim(request.description());
        validate(account, type, status, amount, currency, request.transactionAt());

        byte[] deduplicationKey = normalization.dedupKey(accountId, type, externalId, amount, currency,
            request.transactionAt(), null);
        Optional<InvestmentAccountTransaction> duplicate = externalId == null
            ? transactions.findByInvestmentAccountIdAndDeduplicationKeyAndDeletedAtIsNull(accountId, deduplicationKey)
            : transactions.findByInvestmentAccountIdAndExternalTransactionIdAndDeletedAtIsNull(accountId, externalId);
        if (duplicate.isPresent()) {
            throw conflict("INVESTMENT_TRANSACTION_DUPLICATE", "Giao dịch tương tự đã tồn tại trong sổ đối soát");
        }

        InvestmentAccountTransaction transaction = new InvestmentAccountTransaction();
        transaction.setUserId(userId);
        transaction.setInvestmentAccountId(accountId);
        transaction.setTransactionType(type);
        transaction.setTransactionStatus(status);
        transaction.setAmount(amount);
        transaction.setCurrency(currency);
        transaction.setTransactionAt(request.transactionAt());
        transaction.setExternalTransactionId(externalId);
        transaction.setDescription(description);
        transaction.setDeduplicationKey(deduplicationKey);
        transaction.setCreatedBy(userId);
        transaction.setUpdatedBy(userId);
        try {
            transactions.saveAndFlush(transaction);
        } catch (DataIntegrityViolationException duplicateRace) {
            throw conflict("INVESTMENT_TRANSACTION_DUPLICATE", "Giao dịch tương tự đã tồn tại trong sổ đối soát");
        }
        metrics.counter("investment.transaction.manual", "type", type.name().toLowerCase(Locale.ROOT)).increment();
        return transactionResponse(transaction);
    }

    @Transactional
    public TransactionResponse updateTransaction(Long userId, Long accountId, Long transactionId,
                                                 UpdateTransactionRequest request) {
        InvestmentAccount account = account(accountId, userId);
        Instant at = request.transactionAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        InvestmentAccountTransaction transaction = transactions
            .findByIdAndUserIdAndInvestmentAccountIdAndDeletedAtIsNull(transactionId, userId, accountId)
            .orElseThrow(() -> missing("INVESTMENT_TRANSACTION_NOT_FOUND"));
        if (request.version() != transaction.getVersion()) {
            throw conflict("INVESTMENT_TRANSACTION_VERSION_CONFLICT", "Giao dịch đã thay đổi, vui lòng tải lại");
        }
        InvestmentTransactionType type = request.transactionType();
        InvestmentTransactionStatus status = request.transactionStatus();
        BigDecimal amount = normalization.amount(request.amount());
        String currency = normalization.currency(request.currency());
        String externalId = normalization.externalId(request.externalTransactionId());
        String description = trim(request.description());
        validate(account, type, status, amount, currency, at);

        Map<String, String> before = editableValues(transaction.getTransactionType(),
            transaction.getTransactionStatus(), transaction.getAmount(), transaction.getCurrency(),
            transaction.getTransactionAt(), transaction.getExternalTransactionId(), transaction.getDescription());
        Map<String, String> after = editableValues(type, status, amount, currency, at,
            externalId, description);
        if (before.equals(after)) return transactionResponse(transaction);

        // Keep the stored key (it may be the SAVE_AS_NEW salted one) unless a key input actually changed.
        boolean keyChanged = transaction.getTransactionType() != type
            || transaction.getAmount().compareTo(amount) != 0
            || !transaction.getCurrency().equals(currency)
            || !transaction.getTransactionAt().equals(at)
            || !Objects.equals(transaction.getExternalTransactionId(), externalId);
        if (keyChanged) {
            byte[] deduplicationKey = normalization.dedupKey(accountId, type, externalId, amount, currency,
                at, null);
            Optional<InvestmentAccountTransaction> duplicate = externalId == null
                ? transactions.findByInvestmentAccountIdAndDeduplicationKeyAndDeletedAtIsNull(accountId, deduplicationKey)
                : transactions.findByInvestmentAccountIdAndExternalTransactionIdAndDeletedAtIsNull(accountId, externalId);
            if (duplicate.filter(other -> !other.getId().equals(transactionId)).isPresent()) {
                throw conflict("INVESTMENT_TRANSACTION_DUPLICATE", "Giao dịch tương tự đã tồn tại trong sổ đối soát");
            }
            transaction.setDeduplicationKey(deduplicationKey);
        }
        transaction.setTransactionType(type);
        transaction.setTransactionStatus(status);
        transaction.setAmount(amount);
        transaction.setCurrency(currency);
        transaction.setTransactionAt(at);
        transaction.setExternalTransactionId(externalId);
        transaction.setDescription(description);
        transaction.setUpdatedBy(userId);
        try {
            transactions.saveAndFlush(transaction);
        } catch (DataIntegrityViolationException duplicateRace) {
            throw conflict("INVESTMENT_TRANSACTION_DUPLICATE", "Giao dịch tương tự đã tồn tại trong sổ đối soát");
        } catch (org.springframework.orm.ObjectOptimisticLockingFailureException concurrentEdit) {
            throw conflict("INVESTMENT_TRANSACTION_VERSION_CONFLICT", "Giao dịch đã thay đổi, vui lòng tải lại");
        }
        // Append-only edit history (never updated or deleted).
        jdbc.update("""
            INSERT INTO investment_account_transaction_edits(transaction_id, edited_by, old_values, new_values)
            VALUES (?, ?, ?, ?)
            """, transactionId, userId, json(before), json(after));
        metrics.counter("investment.transaction.updated").increment();
        return transactionResponse(transaction);
    }

    private Map<String, String> editableValues(InvestmentTransactionType type, InvestmentTransactionStatus status,
                                               BigDecimal amount, String currency, Instant transactionAt,
                                               String externalId, String description) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("transactionType", type == null ? null : type.name());
        values.put("transactionStatus", status == null ? null : status.name());
        values.put("amount", amount == null ? null : amount.setScale(4, java.math.RoundingMode.HALF_UP).toPlainString());
        values.put("currency", currency);
        values.put("transactionAt", transactionAt == null ? null : transactionAt.toString());
        values.put("externalTransactionId", externalId);
        values.put("description", description);
        return values;
    }

    @Transactional(readOnly = true)
    public StatisticsResponse statistics(Long userId, Long accountId, LocalDate fromDate, LocalDate toDate,
                                         InvestmentTransactionStatus status) {
        InvestmentAccount account = account(accountId, userId);
        ZoneId zone = ZoneId.of(transactionImportTimeZone);
        Instant from = fromDate == null ? null : fromDate.atStartOfDay(zone).toInstant();
        Instant to = toDate == null ? null : toDate.plusDays(1).atStartOfDay(zone).toInstant();
        List<InvestmentTypeSummary> byType = transactions.summarize(userId, accountId, from, to, status);
        BigDecimal totalAmount = byType.stream()
            .map(InvestmentTypeSummary::amount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netAmount = byType.stream().map(summary ->
                summary.transactionType() == InvestmentTransactionType.WITHDRAWAL
                    ? summary.amount().negate() : summary.amount())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalCount = byType.stream().mapToLong(InvestmentTypeSummary::count).sum();
        int zoneOffsetSeconds = zone.getRules().getOffset(Instant.now()).getTotalSeconds();
        return new StatisticsResponse(accountId, account.getCurrency(), fromDate, toDate, status,
            totalCount, totalAmount, netAmount, byType, transactions.summarizeDaily(userId, accountId, from, to,
            status == null ? null : status.name(), zoneOffsetSeconds).stream().map(this::dailyFlow).toList());
    }

    private DailyFlow dailyFlow(Object[] row) {
        return new DailyFlow(toLocalDate(row[0]), decimal(row[1]), decimal(row[2]), decimal(row[3]));
    }

    private LocalDate toLocalDate(Object value) {
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        if (value instanceof LocalDate date) return date;
        return LocalDate.parse(String.valueOf(value));
    }

    private BigDecimal decimal(Object value) {
        return value instanceof BigDecimal number ? number : new BigDecimal(String.valueOf(value));
    }

    private void createItems(InvestmentAccount account, Long attachmentId, AttachmentDtos.AiDraftResponse draft,
                             Long userId) {
        if (draft.transactions() == null) return;
        // Loaded once; new rows are appended (highest id last) so later rows still merge into earlier ones.
        List<InvestmentTransactionImportItem> openItems = new ArrayList<>(items.findOpenByAccount(account.getId()));
        for (AttachmentDtos.AiTransactionDraftResponse raw : draft.transactions()) {
            InvestmentTransactionImportItem item = toItem(account, attachmentId, raw, userId);
            InvestmentTransactionImportItem merged = mergeCandidate(openItems, item);
            if (merged == null) {
                items.saveAndFlush(item);
                openItems.add(item);
                linkSource(item.getId(), attachmentId);
            } else {
                linkSource(merged.getId(), attachmentId);
            }
        }
    }

    private InvestmentTransactionImportItem toItem(InvestmentAccount account, Long attachmentId,
                                                   AttachmentDtos.AiTransactionDraftResponse raw, Long userId) {
        InvestmentTransactionImportItem item = new InvestmentTransactionImportItem();
        item.setItemId(UUID.randomUUID().toString());
        item.setInvestmentAccountId(account.getId());
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
        item.setCreatedBy(userId);
        item.setUpdatedBy(userId);
        metrics.counter("investment.import.item", "action", decision.action().name().toLowerCase(Locale.ROOT)).increment();
        if (decision.action() == InvestmentProcessingAction.REVIEW) {
            metrics.counter("investment.import.review.required").increment();
        }
        if (decision.action() == InvestmentProcessingAction.DUPLICATE) {
            metrics.counter("investment.import.duplicate").increment();
        }
        return item;
    }

    private InvestmentTransactionImportItem mergeCandidate(List<InvestmentTransactionImportItem> openItems,
                                                           InvestmentTransactionImportItem incoming) {
        for (InvestmentTransactionImportItem existing : openItems) {
            boolean sameExternal = incoming.getExternalTransactionId() != null
                && incoming.getExternalTransactionId().equals(existing.getExternalTransactionId());
            boolean sameKey = incoming.getDeduplicationKey() != null && existing.getDeduplicationKey() != null
                && Arrays.equals(incoming.getDeduplicationKey(), existing.getDeduplicationKey());
            if (!sameExternal && !sameKey) continue;
            List<String> warnings = new ArrayList<>(warnings(existing.getWarnings()));
            if (!Objects.equals(existing.getTransactionType(), incoming.getTransactionType()))
                warnings.add("TYPE_CONFLICT");
            if (existing.getAmount() != null && incoming.getAmount() != null
                && existing.getAmount().compareTo(incoming.getAmount()) != 0) warnings.add("AMOUNT_CONFLICT");
            if (!Objects.equals(existing.getCurrency(), incoming.getCurrency())) warnings.add("CURRENCY_CONFLICT");
            // BONUS has no external id by design (one bonus per day identifies it), so a same-day
            // match is a confident duplicate, not an ambiguous fallback collision like it would be
            // for a deposit/withdrawal matched only by amount+time without an external id.
            boolean weakFallbackMatch = incoming.getExternalTransactionId() == null
                && incoming.getTransactionType() != InvestmentTransactionType.BONUS;
            if (hasConflict(warnings) || weakFallbackMatch) {
                if (weakFallbackMatch) warnings.add("FALLBACK_DEDUP_COLLISION");
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
            } else {
                existing.setProcessingAction(InvestmentProcessingAction.DUPLICATE);
            }
            existing.setWarnings(json(warnings.stream().distinct().toList()));
            return existing;
        }
        return null;
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
            transaction.getRawText(), transaction.getAiConfidence(), transaction.getSourceFileHash(),
            transaction.getSourceAttachmentId(), transaction.getVersion());
    }

    private Candidate candidate(InvestmentTransactionImportItem item, InvestmentAccount account, List<String> warnings) {
        return new Candidate(item.getItemId(), account.getId(), account.getCurrency(), item.getTransactionType(),
            item.getTransactionStatus(), item.getAmount(), item.getCurrency(), item.getTransactionAt(),
            item.getExternalTransactionId(), item.getAiConfidence(), warnings);
    }

    private void validateUploads(List<MultipartFile> uploads) {
        if (uploads == null || uploads.isEmpty() || uploads.size() > MAX_FILES) {
            throw bad("INVALID_IMPORT_FILE_COUNT", "Mỗi batch phải có từ 1 đến 10 ảnh");
        }
        long total = uploads.stream().mapToLong(MultipartFile::getSize).sum();
        if (total > MAX_UPLOAD_BYTES) throw bad("IMPORT_BATCH_TOO_LARGE", "Tổng dung lượng batch không được vượt 50 MB");
    }

    private boolean isReady(AttachmentAiStatus status) {
        return status == AttachmentAiStatus.READY || status == AttachmentAiStatus.CONFIRMED;
    }

    private InvestmentAccount account(Long accountId, Long userId) {
        return accounts.findByIdAndUserIdAndDeletedAtIsNull(accountId, userId)
            .orElseThrow(() -> missing("INVESTMENT_ACCOUNT_NOT_FOUND"));
    }

    private void linkSource(Long itemId, Long attachmentId) {
        jdbc.update("INSERT IGNORE INTO investment_transaction_import_item_sources(import_item_id, attachment_id) VALUES (?, ?)",
            itemId, attachmentId);
    }

    private AttachmentDtos.AiDraftResponse parseDraft(String json) {
        try {
            return json == null ? null : objectMapper.readValue(json, AttachmentDtos.AiDraftResponse.class);
        } catch (JsonProcessingException _) {
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
            return value == null ? new ArrayList<>() : objectMapper.readValue(value, new TypeReference<>() {
            });
        } catch (JsonProcessingException _) {
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

    private void validate(InvestmentAccount account, InvestmentTransactionType type,
                          InvestmentTransactionStatus status, BigDecimal amount, String currency,
                          Instant transactionAt) {
        if (type == null || status == null || amount == null || amount.signum() <= 0
            || currency == null || transactionAt == null) {
            throw bad("INVALID_IMPORT_TRANSACTION", "Loại, trạng thái, số tiền, tiền tệ và thời gian là bắt buộc");
        }
        if (!Objects.equals(account.getCurrency(), currency)) {
            throw bad("INVESTMENT_CURRENCY_MISMATCH", "Tiền tệ giao dịch phải khớp với tài khoản");
        }
    }

    private <E extends Enum<E>> E enumValue(Class<E> type, String value) {
        try {
            return value == null ? null : Enum.valueOf(type, value);
        } catch (IllegalArgumentException _) {
            return null;
        }
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    private ApiException missing(String code) {
        return new ApiException(HttpStatus.NOT_FOUND, code, "Không tìm thấy dữ liệu");
    }
}

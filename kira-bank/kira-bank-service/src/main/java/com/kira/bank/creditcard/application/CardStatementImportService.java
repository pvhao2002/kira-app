package com.kira.bank.creditcard.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.ai.AiDocumentService.AiCardStatementExtraction;
import com.kira.bank.ai.AiDocumentService.AiCardTransactionExtraction;
import com.kira.bank.ai.AiJobProperties;
import com.kira.bank.attachment.application.AttachmentDtos.AttachmentResponse;
import com.kira.bank.attachment.application.AttachmentService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.creditcard.application.CardCashbackCalculator.ActiveRule;
import com.kira.bank.creditcard.application.CardCashbackCalculator.CardRules;
import com.kira.bank.creditcard.domain.*;
import com.kira.bank.creditcard.infrastructure.*;
import com.kira.bank.notification.application.NotificationService;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.bank.creditcard.application.CardStatementImportDtos.*;

@Service
@RequiredArgsConstructor
public class CardStatementImportService {
    public static final String MODULE = "credit-card";
    public static final String DOCUMENT_TYPE = "STATEMENT";
    static final int MAX_FILES = 3;
    private static final Duration RETENTION = Duration.ofDays(30);
    private static final BigDecimal REVIEW_CONFIDENCE = new BigDecimal("0.80");
    private static final BigDecimal TOTAL_TOLERANCE = BigDecimal.ONE;
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
        DateTimeFormatter.ISO_LOCAL_DATE, DateTimeFormatter.ofPattern("dd/MM/yyyy"),
        DateTimeFormatter.ofPattern("d/M/yyyy"), DateTimeFormatter.ofPattern("dd-MM-yyyy"),
        DateTimeFormatter.ofPattern("dd.MM.yyyy"));
    private static final Set<String> UPDATABLE_STATUSES = Set.of("NEEDS_INPUT", "OPEN", "UNPAID");

    private final CardStatementImportRepository imports;
    private final CardStatementImportFileRepository importFiles;
    private final CardTransactionRepository transactions;
    private final UserCreditCardRepository cards;
    private final StatementRepository statements;
    private final PaymentRepository payments;
    private final AttachmentService attachmentService;
    private final AttachmentRepository attachments;
    private final CardCashbackCalculator calculator;
    private final CardMerchantRuleService merchantRules;
    private final NotificationService notifications;
    private final AiDocumentService ai;
    private final AiJobProperties jobProperties;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher events;

    /** Published after an import becomes QUEUED so the runner can start it once the transaction commits. */
    public record ImportQueuedEvent(Long importId) {
    }

    /** Snapshot handed to the AI processor; carries no JPA state across the long-running call. */
    public record ClaimedImport(Long importId, Long cardId, List<ClaimedPage> pages, List<String> categoryNames) {
    }

    public record ClaimedPage(Long attachmentId, Long r2AccountId, String storageKey, String mimeType) {
    }

    // ---------------------------------------------------------------- user API

    @Transactional
    public StatementImportResponse create(Long userId, Long cardId, List<MultipartFile> files) throws IOException {
        UserCreditCard card = ownCard(userId, cardId);
        List<MultipartFile> uploads = files == null ? List.of()
            : files.stream().filter(file -> file != null && !file.isEmpty()).toList();
        if (uploads.isEmpty())
            throw bad("STATEMENT_IMPORT_FILES_REQUIRED", "Cần ít nhất một ảnh sao kê");
        if (uploads.size() > MAX_FILES)
            throw bad("STATEMENT_IMPORT_TOO_MANY_FILES", "Mỗi lần chỉ nhập tối đa " + MAX_FILES + " ảnh sao kê");
        for (MultipartFile upload : uploads) {
            if (!isSupportedImage(upload.getBytes()))
                throw bad("INVALID_FILE_TYPE", "Sao kê chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP");
        }

        CardStatementImport statementImport = new CardStatementImport();
        statementImport.setUserId(userId);
        statementImport.setUserCardId(card.getId());
        statementImport.setStatus(CardStatementImportStatus.QUEUED);
        statementImport.setNextAttemptAt(Instant.now());
        statementImport.setCreatedBy(userId);
        statementImport.setUpdatedBy(userId);
        imports.saveAndFlush(statementImport);

        int page = 1;
        for (MultipartFile upload : uploads) {
            AttachmentResponse stored = attachmentService.upload(userId, MODULE, DOCUMENT_TYPE, upload);
            CardStatementImportFile file = new CardStatementImportFile();
            file.setImportId(statementImport.getId());
            file.setAttachmentId(stored.attachmentId());
            file.setPageNumber(page++);
            file.setCreatedBy(userId);
            file.setUpdatedBy(userId);
            importFiles.save(file);
        }
        events.publishEvent(new ImportQueuedEvent(statementImport.getId()));
        return response(statementImport);
    }

    @Transactional(readOnly = true)
    public StatementImportResponse get(Long userId, Long importId) {
        return response(owned(userId, importId));
    }

    @Transactional(readOnly = true)
    public List<StatementImportResponse> list(Long userId, Long cardId) {
        ownCard(userId, cardId);
        boolean aiConfigured = ai.isConfigured();
        return imports.findByUserIdAndUserCardIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId, cardId,
                PageRequest.of(0, 20))
            .stream().map(statementImport -> response(statementImport, aiConfigured)).toList();
    }

    @Transactional
    public StatementImportResponse cancel(Long userId, Long importId, VersionRequest request) {
        CardStatementImport statementImport = ownedForUpdate(userId, importId);
        requireVersion(statementImport, request.version());
        if (statementImport.getStatus() == CardStatementImportStatus.CANCELLED) return response(statementImport);
        if (statementImport.getStatus() == CardStatementImportStatus.PROCESSING)
            throw conflict("STATEMENT_IMPORT_PROCESSING", "AI đang xử lý sao kê, vui lòng thử lại sau");
        if (statementImport.getStatus() == CardStatementImportStatus.CONFIRMED)
            throw conflict("STATEMENT_IMPORT_ALREADY_CONFIRMED", "Sao kê đã được xác nhận");
        Instant now = Instant.now();
        statementImport.setStatus(CardStatementImportStatus.CANCELLED);
        statementImport.setNextAttemptAt(null);
        statementImport.setCompletedAt(now);
        statementImport.setRetentionUntil(now);
        statementImport.setUpdatedBy(userId);
        return response(save(statementImport));
    }

    @Transactional
    public StatementImportResponse retry(Long userId, Long importId, VersionRequest request) {
        CardStatementImport statementImport = ownedForUpdate(userId, importId);
        requireVersion(statementImport, request.version());
        if (statementImport.getStatus() != CardStatementImportStatus.FAILED)
            throw conflict("STATEMENT_IMPORT_NOT_RETRYABLE", "Chỉ thử lại được sao kê đã lỗi");
        if (statementImport.getStoragePurgedAt() != null)
            throw new ApiException(HttpStatus.GONE, "ATTACHMENT_PURGED", "Ảnh sao kê đã bị xoá theo chính sách lưu trữ");
        statementImport.setStatus(CardStatementImportStatus.QUEUED);
        statementImport.setAttemptCount(0);
        statementImport.setAiError(null);
        statementImport.setNextAttemptAt(Instant.now());
        statementImport.setCompletedAt(null);
        statementImport.setRetentionUntil(null);
        statementImport.setUpdatedBy(userId);
        save(statementImport);
        events.publishEvent(new ImportQueuedEvent(statementImport.getId()));
        return response(statementImport);
    }

    @Transactional
    public ConfirmResponse confirm(Long userId, Long importId, ConfirmRequest request) {
        CardStatementImport statementImport = ownedForUpdate(userId, importId);
        if (statementImport.getStatus() == CardStatementImportStatus.CONFIRMED
            && statementImport.getConfirmResult() != null) {
            return read(statementImport.getConfirmResult(), ConfirmResponse.class);
        }
        if (statementImport.getStatus() != CardStatementImportStatus.READY)
            throw unprocessable("STATEMENT_IMPORT_NOT_READY", "Sao kê chưa sẵn sàng để xác nhận");
        requireVersion(statementImport, request.version());
        UserCreditCard card = ownCard(userId, statementImport.getUserCardId());
        validateTotals(request);
        CardRules cardRules = calculator.load(card.getId());

        BigDecimal balance = money(request.statementBalance());
        BigDecimal minimum = balance.signum() == 0 ? zero() : money(request.minimumPayment());
        Statement statement = statements.findFirstByUserCardIdAndStatementDateBetweenAndDeletedAtIsNullOrderByStatementDateDesc(
            card.getId(), YearMonth.from(request.statementDate()).atDay(1),
            YearMonth.from(request.statementDate()).atEndOfMonth()).orElse(null);
        boolean totalsApplied;
        if (statement == null) {
            statement = new Statement();
            statement.setUserId(userId);
            statement.setUserCardId(card.getId());
            statement.setCreatedBy(userId);
            applyTotals(statement, request, balance, minimum);
            totalsApplied = true;
        } else if (canReplaceTotals(statement)) {
            applyTotals(statement, request, balance, minimum);
            totalsApplied = true;
        } else {
            totalsApplied = false;
        }
        statement.setUpdatedBy(userId);
        List<CardStatementImportFile> files = importFiles.findByImportIdAndDeletedAtIsNullOrderByPageNumberAsc(importId);
        if (statement.getAttachmentId() == null && !files.isEmpty()) {
            statement.setAttachmentId(files.getFirst().getAttachmentId());
        }
        try {
            statements.saveAndFlush(statement);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw conflict("STATEMENT_VERSION_CONFLICT", "Dữ liệu sao kê đã được cập nhật ở phiên khác");
        }

        int inserted = 0;
        int skipped = 0;
        CardTransactionKeys.OccurrenceCounter keys = new CardTransactionKeys.OccurrenceCounter();
        for (ConfirmTransactionRequest row : request.transactions()) {
            byte[] key = keys.next(card.getId(), row.transactionDate(), money(row.amount()), row.transactionType(),
                row.description());
            if (!Boolean.TRUE.equals(row.include())) continue;
            if (row.cashbackRuleId() != null && cardRules.byId(row.cashbackRuleId()).isEmpty())
                throw bad("CASHBACK_RULE_NOT_FOUND", "Nhóm cashback không thuộc thẻ này");
            if (row.rememberPattern() != null && !row.rememberPattern().isBlank() && row.mccCode() != null) {
                merchantRules.upsert(userId, row.rememberPattern(), row.mccCode(), null, false);
            }
            CardTransaction transaction = transactions.findByUserCardIdAndDedupKey(card.getId(), key).orElse(null);
            if (transaction != null && transaction.getDeletedAt() == null) {
                skipped++;
                continue;
            }
            if (transaction == null) {
                transaction = new CardTransaction();
                transaction.setUserId(userId);
                transaction.setUserCardId(card.getId());
                transaction.setDedupKey(key);
                transaction.setCreatedBy(userId);
            }
            transaction.setDeletedAt(null);
            transaction.setStatementId(statement.getId());
            transaction.setImportId(statementImport.getId());
            transaction.setTransactionDate(row.transactionDate());
            transaction.setPostingDate(row.postingDate());
            transaction.setDescription(row.description().trim());
            transaction.setAmount(money(row.amount()));
            transaction.setCurrency(card.getCurrency());
            transaction.setTransactionType(row.transactionType());
            transaction.setMccCode(row.mccCode());
            transaction.setCashbackRuleId(row.cashbackRuleId());
            transaction.setSource(CardTransactionSource.AI_IMPORT);
            transaction.setUpdatedBy(userId);
            transactions.save(transaction);
            inserted++;
        }
        int superseded = 0;
        if (inserted + skipped > 0 && statement.getPeriodStart() != null && statement.getPeriodEnd() != null) {
            // The imported statement is now the source of truth for its period; manual entries logged for the same
            // period would otherwise be counted twice against cashback caps and available credit.
            for (CardTransaction manual : transactions
                .findByUserCardIdInAndStatementIdIsNullAndTransactionDateGreaterThanEqualAndDeletedAtIsNull(
                    List.of(card.getId()), statement.getPeriodStart())) {
                if (manual.getSource() != CardTransactionSource.MANUAL
                    || manual.getTransactionDate().isAfter(statement.getPeriodEnd())) continue;
                manual.setDeletedAt(Instant.now());
                manual.setUpdatedBy(userId);
                transactions.save(manual);
                superseded++;
            }
        }
        transactions.flush();

        BigDecimal expectedCashback = calculator.usage(cardRules,
            transactions.findByStatementIdAndDeletedAtIsNull(statement.getId())).cardEarned();
        statement.setExpectedCashback(expectedCashback);
        statements.saveAndFlush(statement);

        ConfirmResponse result = new ConfirmResponse(statement.getId(), totalsApplied, inserted, skipped,
            superseded, expectedCashback);
        Instant now = Instant.now();
        statementImport.setStatus(CardStatementImportStatus.CONFIRMED);
        statementImport.setStatementId(statement.getId());
        statementImport.setConfirmResult(write(result));
        statementImport.setCompletedAt(now);
        statementImport.setRetentionUntil(now.plus(RETENTION));
        statementImport.setUpdatedBy(userId);
        save(statementImport);
        return result;
    }

    // ---------------------------------------------------------------- AI job lifecycle

    /** Claims one specific import if it is still waiting. Returns empty when another worker took it. */
    @Transactional
    public Optional<ClaimedImport> claim(Long importId) {
        CardStatementImport statementImport = imports.findForUpdate(importId).orElse(null);
        if (statementImport == null || statementImport.getStatus() != CardStatementImportStatus.QUEUED) {
            return Optional.empty();
        }
        return Optional.of(start(statementImport));
    }

    @Transactional
    public Optional<ClaimedImport> claimNext() {
        List<CardStatementImport> claimable = imports.findClaimableForUpdate(CardStatementImportStatus.QUEUED,
            Instant.now(), PageRequest.of(0, 1));
        return claimable.isEmpty() ? Optional.empty() : Optional.of(start(claimable.getFirst()));
    }

    @Transactional
    public void recoverStaleProcessing() {
        Instant cutoff = Instant.now().minus(jobProperties.safeProcessingTimeout());
        for (CardStatementImport statementImport : imports.findStaleProcessingForUpdate(
            CardStatementImportStatus.PROCESSING, cutoff)) {
            retryOrFail(statementImport, "AI_PROCESSING_TIMEOUT");
        }
    }

    @Transactional
    public void markReady(Long importId, AiCardStatementExtraction extraction, String model) {
        CardStatementImport statementImport = imports.findForUpdate(importId).orElse(null);
        if (statementImport == null || statementImport.getStatus() != CardStatementImportStatus.PROCESSING) return;
        UserCreditCard card = cards.findById(statementImport.getUserCardId()).orElseThrow();
        StatementDraft draft = normalize(card, calculator.load(card.getId()),
            merchantRules.matcher(statementImport.getUserId()), extraction);
        statementImport.setStatus(CardStatementImportStatus.READY);
        statementImport.setAiModel(model);
        statementImport.setAiResult(write(draft));
        statementImport.setAiError(null);
        statementImport.setProcessingStartedAt(null);
        statementImport.setCompletedAt(Instant.now());
        // An unreviewed draft does not need the source images; they are purged on the same 30-day schedule.
        statementImport.setRetentionUntil(Instant.now().plus(RETENTION));
        save(statementImport);
        notifications.createIfAbsent(statementImport.getUserId(), "CREDIT_STATEMENT_IMPORT_READY", "CREDIT_CARD",
            "AI đã đọc xong sao kê", "Sao kê thẻ " + card.getNickname()
                + " đã có kết quả, hãy kiểm tra và xác nhận.", "SUCCESS",
            "/statement-import?id=" + statementImport.getId());
    }

    @Transactional
    public void markRetryOrFailed(Long importId, String reason) {
        CardStatementImport statementImport = imports.findForUpdate(importId).orElse(null);
        if (statementImport == null || statementImport.getStatus() != CardStatementImportStatus.PROCESSING) return;
        retryOrFail(statementImport, reason);
    }

    private ClaimedImport start(CardStatementImport statementImport) {
        Instant now = Instant.now();
        statementImport.setStatus(CardStatementImportStatus.PROCESSING);
        statementImport.setAttemptCount(statementImport.getAttemptCount() + 1);
        statementImport.setProcessingStartedAt(now);
        statementImport.setNextAttemptAt(null);
        statementImport.setAiError(null);
        save(statementImport);
        List<CardStatementImportFile> files =
            importFiles.findByImportIdAndDeletedAtIsNullOrderByPageNumberAsc(statementImport.getId());
        Map<Long, Attachment> byId = attachments.findAllById(
                files.stream().map(CardStatementImportFile::getAttachmentId).toList())
            .stream().collect(Collectors.toMap(Attachment::getId, Function.identity()));
        List<ClaimedPage> pages = files.stream().map(file -> byId.get(file.getAttachmentId()))
            .filter(Objects::nonNull)
            .map(a -> new ClaimedPage(a.getId(), a.getR2AccountId(), a.getStorageKey(), a.getMimeType()))
            .toList();
        List<String> categories = calculator.load(statementImport.getUserCardId()).rules().stream()
            .map(ActiveRule::categoryName).distinct().toList();
        return new ClaimedImport(statementImport.getId(), statementImport.getUserCardId(), pages, categories);
    }

    private void retryOrFail(CardStatementImport statementImport, String reason) {
        statementImport.setAiError(reason);
        statementImport.setProcessingStartedAt(null);
        if (statementImport.getAttemptCount() >= jobProperties.safeMaxAttempts()) {
            Instant now = Instant.now();
            statementImport.setStatus(CardStatementImportStatus.FAILED);
            statementImport.setNextAttemptAt(null);
            statementImport.setCompletedAt(now);
            statementImport.setRetentionUntil(now.plus(RETENTION));
            notifications.createIfAbsent(statementImport.getUserId(), "CREDIT_STATEMENT_IMPORT_FAILED",
                "CREDIT_CARD", "AI không đọc được sao kê",
                "Sao kê đã hết số lần thử. Bạn có thể thử lại hoặc nhập thủ công.", "ERROR",
                "/statement-import?id=" + statementImport.getId());
        } else {
            statementImport.setStatus(CardStatementImportStatus.QUEUED);
            statementImport.setNextAttemptAt(Instant.now().plus(jobProperties.safeRetryDelay()));
        }
        save(statementImport);
    }

    // ---------------------------------------------------------------- draft normalization

    private StatementDraft normalize(UserCreditCard card, CardRules cardRules,
                                     CardMerchantRuleService.Matcher merchantMatcher,
                                     AiCardStatementExtraction extraction) {
        List<String> warnings = new ArrayList<>();
        String currency = trim(extraction.currency());
        if (currency != null && !currency.equalsIgnoreCase(card.getCurrency())) warnings.add("CURRENCY_MISMATCH");
        String lastFour = digits(extraction.cardLastFour(), 4);
        if (lastFour != null && card.getLastFour() != null && !lastFour.equals(card.getLastFour()))
            warnings.add("CARD_LAST_FOUR_MISMATCH");
        BigDecimal confidence = confidence(extraction.confidence());
        if (confidence != null && confidence.compareTo(REVIEW_CONFIDENCE) < 0) warnings.add("LOW_CONFIDENCE");
        LocalDate statementDate = date(extraction.statementDate());
        LocalDate dueDate = date(extraction.dueDate());
        BigDecimal statementBalance = amount(extraction.statementBalance(), true);
        BigDecimal minimumPayment = amount(extraction.minimumPayment(), true);
        if (statementDate == null || dueDate == null || statementBalance == null || minimumPayment == null)
            warnings.add("FIELD_MISSING");

        List<TransactionDraft> rows = new ArrayList<>();
        int ignoredPayments = 0;
        int line = 1;
        BigDecimal spendingTotal = BigDecimal.ZERO;
        CardTransactionKeys.OccurrenceCounter keys = new CardTransactionKeys.OccurrenceCounter();
        List<AiCardTransactionExtraction> extracted = extraction.transactions() == null ? List.of()
            : extraction.transactions();
        for (AiCardTransactionExtraction row : extracted) {
            if (row == null) continue;
            if ("PAYMENT".equalsIgnoreCase(trim(row.transactionType()))) {
                ignoredPayments++;
                continue;
            }
            List<String> rowWarnings = new ArrayList<>();
            CardTransactionType type = transactionType(row.transactionType());
            LocalDate date = date(row.transactionDate());
            BigDecimal amount = amount(row.amount(), false);
            String description = truncate(trim(row.description()), 500);
            if (type == null || date == null || amount == null || description == null) rowWarnings.add("FIELD_MISSING");
            BigDecimal rowConfidence = confidence(row.confidence());
            if (rowConfidence != null && rowConfidence.compareTo(REVIEW_CONFIDENCE) < 0) rowWarnings.add("LOW_CONFIDENCE");
            if (row.uncertainFields() != null && !row.uncertainFields().isEmpty()) rowWarnings.add("UNCERTAIN_FIELDS");
            String mcc = digits(row.mccCode(), 4);
            boolean merchantRuleApplied = false;
            if (mcc == null) {
                // A remembered merchant is the user's own decision, so it beats the AI's category guess.
                Optional<String> remembered = merchantMatcher.mccFor(description);
                if (remembered.isPresent()) {
                    mcc = remembered.get();
                    merchantRuleApplied = true;
                }
            }
            Optional<ActiveRule> rule = merchantRuleApplied ? cardRules.bestForMcc(mcc) : Optional.empty();
            if (rule.isEmpty()) rule = cardRules.byCategoryName(row.suggestedCategory());
            if (rule.isEmpty()) rule = cardRules.bestForMcc(mcc);
            boolean duplicate = false;
            if (type != null && date != null && amount != null) {
                byte[] key = keys.next(card.getId(), date, amount, type, description);
                duplicate = transactions.findByUserCardIdAndDedupKey(card.getId(), key)
                    .filter(existing -> existing.getDeletedAt() == null).isPresent();
                if (duplicate) rowWarnings.add("DUPLICATE");
            }
            if (type == CardTransactionType.SPENDING && amount != null) spendingTotal = spendingTotal.add(amount);
            rows.add(new TransactionDraft(line++, date, date(row.postingDate()), description, amount, type, mcc,
                rule.map(ActiveRule::ruleId).orElse(null), truncate(trim(row.suggestedCategory()), 150),
                rowConfidence, duplicate, !rowWarnings.isEmpty() && !(duplicate && rowWarnings.size() == 1),
                merchantRuleApplied, rowWarnings));
        }
        BigDecimal totalSpending = amount(extraction.totalSpending(), true);
        if (totalSpending != null && !rows.isEmpty()
            && totalSpending.subtract(spendingTotal).abs().compareTo(TOTAL_TOLERANCE) > 0) {
            warnings.add("TOTAL_MISMATCH");
        }
        if (ignoredPayments > 0) warnings.add("PAYMENT_ROWS_IGNORED");
        List<String> aiWarnings = extraction.validationWarnings() == null ? List.of()
            : extraction.validationWarnings().stream().map(this::trim).filter(Objects::nonNull)
            .map(value -> truncate(value, 200)).limit(10).toList();
        return new StatementDraft(statementDate, dueDate, date(extraction.periodStart()), date(extraction.periodEnd()),
            amount(extraction.openingBalance(), true), totalSpending, amount(extraction.totalRefund(), true),
            amount(extraction.totalFee(), true), amount(extraction.totalInterest(), true), statementBalance,
            minimumPayment, currency == null ? card.getCurrency() : currency.toUpperCase(Locale.ROOT), lastFour,
            confidence, warnings, aiWarnings, ignoredPayments, rows);
    }

    // ---------------------------------------------------------------- helpers

    private boolean canReplaceTotals(Statement statement) {
        return UPDATABLE_STATUSES.contains(statement.getStatus())
            && statement.getPaidAmount().signum() == 0
            && !payments.existsByStatementIdAndDeletedAtIsNull(statement.getId());
    }

    private void applyTotals(Statement statement, ConfirmRequest request, BigDecimal balance, BigDecimal minimum) {
        statement.setStatementDate(request.statementDate());
        statement.setDueDate(request.dueDate());
        statement.setPeriodStart(request.periodStart() != null ? request.periodStart()
            : statement.getPeriodStart() != null ? statement.getPeriodStart()
            : request.statementDate().minusMonths(1).plusDays(1));
        statement.setPeriodEnd(request.periodEnd() != null ? request.periodEnd() : request.statementDate());
        statement.setOpeningBalance(moneyOrZero(request.openingBalance()));
        statement.setTotalSpending(moneyOrZero(request.totalSpending()));
        statement.setTotalRefund(moneyOrZero(request.totalRefund()));
        statement.setTotalFee(moneyOrZero(request.totalFee()));
        statement.setTotalInterest(moneyOrZero(request.totalInterest()));
        statement.setStatementBalance(balance);
        statement.setMinimumPayment(minimum);
        statement.setPaidAmount(zero());
        statement.setRemainingAmount(balance);
        statement.setStatus(balance.signum() == 0 ? "PAID" : "OPEN");
    }

    private void validateTotals(ConfirmRequest request) {
        if (request.dueDate().isBefore(request.statementDate()))
            throw unprocessable("INVALID_STATEMENT_DATES", "Ngày đến hạn không được trước ngày sao kê");
        if (request.periodStart() != null && request.periodEnd() != null
            && request.periodEnd().isBefore(request.periodStart()))
            throw unprocessable("INVALID_STATEMENT_DATES", "Kỳ sao kê không hợp lệ");
        BigDecimal balance = request.statementBalance();
        if (balance.signum() > 0 && request.minimumPayment().signum() == 0)
            throw unprocessable("MINIMUM_PAYMENT_REQUIRED", "Thanh toán tối thiểu phải lớn hơn 0 khi sao kê có dư nợ");
        if (request.minimumPayment().compareTo(balance) > 0)
            throw unprocessable("MINIMUM_PAYMENT_EXCEEDS_BALANCE", "Thanh toán tối thiểu không được vượt tổng dư nợ");
    }

    private StatementImportResponse response(CardStatementImport statementImport) {
        return response(statementImport, ai.isConfigured());
    }

    private StatementImportResponse response(CardStatementImport statementImport, boolean aiConfigured) {
        List<CardStatementImportFile> files =
            importFiles.findByImportIdAndDeletedAtIsNullOrderByPageNumberAsc(statementImport.getId());
        Map<Long, Attachment> byId = attachments.findAllById(
                files.stream().map(CardStatementImportFile::getAttachmentId).toList())
            .stream().collect(Collectors.toMap(Attachment::getId, Function.identity()));
        List<ImportFileResponse> fileResponses = files.stream().map(file -> new ImportFileResponse(
            file.getAttachmentId(), file.getPageNumber(),
            Optional.ofNullable(byId.get(file.getAttachmentId())).map(Attachment::getOriginalName).orElse(null)))
            .toList();
        StatementDraft draft = statementImport.getAiResult() == null ? null
            : read(statementImport.getAiResult(), StatementDraft.class);
        ConfirmResponse result = statementImport.getConfirmResult() == null ? null
            : read(statementImport.getConfirmResult(), ConfirmResponse.class);
        return new StatementImportResponse(statementImport.getId(), statementImport.getUserCardId(),
            statementImport.getStatus(), statementImport.getAttemptCount(), statementImport.getAiError(),
            statementImport.getVersion(), statementImport.getCreatedAt(), statementImport.getCompletedAt(),
            aiConfigured, statementImport.getStoragePurgedAt() != null, fileResponses, draft,
            statementImport.getStatementId(), result);
    }

    private CardStatementImport save(CardStatementImport statementImport) {
        try {
            return imports.saveAndFlush(statementImport);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw conflict("STATEMENT_IMPORT_VERSION_CONFLICT", "Sao kê đã được cập nhật, vui lòng tải lại");
        }
    }

    private boolean isSupportedImage(byte[] data) {
        if (data.length >= 3 && (data[0] & 0xff) == 0xff && (data[1] & 0xff) == 0xd8 && (data[2] & 0xff) == 0xff)
            return true;
        byte[] png = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        if (data.length >= png.length && Arrays.equals(Arrays.copyOf(data, png.length), png)) return true;
        return data.length >= 12
            && new String(data, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF")
            && new String(data, 8, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP");
    }

    private LocalDate date(String raw) {
        String value = trim(raw);
        if (value == null) return null;
        if (value.length() > 10 && value.charAt(4) == '-') value = value.substring(0, 10);
        for (DateTimeFormatter format : DATE_FORMATS) {
            try {
                return LocalDate.parse(value, format);
            } catch (DateTimeParseException ignored) {
                // try the next printed format
            }
        }
        return null;
    }

    private BigDecimal amount(BigDecimal value, boolean allowZero) {
        if (value == null || value.signum() < 0 || (!allowZero && value.signum() == 0)) return null;
        if (value.compareTo(new BigDecimal("999999999999999")) > 0) return null;
        return money(value);
    }

    private BigDecimal confidence(Double value) {
        if (value == null || value.isNaN() || value < 0 || value > 1) return null;
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }

    private CardTransactionType transactionType(String raw) {
        String value = trim(raw);
        if (value == null) return null;
        try {
            return CardTransactionType.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String digits(String raw, int length) {
        if (raw == null) return null;
        String value = raw.replaceAll("\\D", "");
        if (value.length() < length) return null;
        return value.substring(value.length() - length);
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal moneyOrZero(BigDecimal value) {
        return value == null ? zero() : money(value);
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize statement import data", ex);
        }
    }

    private <T> T read(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to read statement import data", ex);
        }
    }

    private void requireVersion(CardStatementImport statementImport, Long version) {
        if (version == null || version != statementImport.getVersion())
            throw conflict("STATEMENT_IMPORT_VERSION_CONFLICT", "Sao kê đã được cập nhật, vui lòng tải lại");
    }

    private UserCreditCard ownCard(Long userId, Long cardId) {
        return cards.findByIdAndUserIdAndDeletedAtIsNull(cardId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_CARD_NOT_FOUND", "Không tìm thấy thẻ"));
    }

    private CardStatementImport owned(Long userId, Long importId) {
        return imports.findByIdAndUserIdAndDeletedAtIsNull(importId, userId).orElseThrow(this::missing);
    }

    private CardStatementImport ownedForUpdate(Long userId, Long importId) {
        return imports.findOwnedForUpdate(importId, userId).orElseThrow(this::missing);
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "STATEMENT_IMPORT_NOT_FOUND", "Không tìm thấy lượt nhập sao kê");
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private ApiException unprocessable(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }

    private ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
}

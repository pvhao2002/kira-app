package com.kira.bank.investment.application;

import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.investment.domain.*;
import com.kira.bank.investment.infrastructure.InvestmentAccountRepository;
import com.kira.bank.investment.infrastructure.InvestmentAccountTransactionRepository;
import com.kira.bank.investment.infrastructure.InvestmentTransactionImportItemRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import static com.kira.bank.investment.application.InvestmentTransactionDeduplicationService.Candidate;
import static com.kira.bank.investment.application.InvestmentTransactionImportDtos.ConfirmItemRequest;
import static com.kira.bank.investment.application.InvestmentTransactionImportDtos.ConfirmItemResult;

@Service
@RequiredArgsConstructor
public class InvestmentTransactionItemConfirmationService {
    private final InvestmentAccountRepository accounts;
    private final InvestmentAccountTransactionRepository transactions;
    private final InvestmentTransactionImportItemRepository items;
    private final AttachmentRepository attachments;
    private final InvestmentTransactionNormalizationService normalization;
    private final InvestmentTransactionDeduplicationService deduplication;
    private final JdbcTemplate jdbc;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ConfirmItemResult confirmOne(Long userId, Long accountId, Long batchDatabaseId,
                                        ConfirmItemRequest request) {
        InvestmentAccount account = accounts.findByIdAndUserIdAndDeletedAtIsNull(accountId, userId)
            .orElseThrow(() -> missing("INVESTMENT_ACCOUNT_NOT_FOUND"));
        InvestmentTransactionImportItem item = items.findForUpdate(request.itemId(), batchDatabaseId)
            .orElseThrow(() -> missing("IMPORT_ITEM_NOT_FOUND"));
        if (item.getConfirmedTransactionId() != null) {
            return new ConfirmItemResult(item.getItemId(), "SKIPPED", item.getConfirmedTransactionId(), null);
        }
        if (item.getResolution() == InvestmentImportResolution.SKIP) {
            return new ConfirmItemResult(item.getItemId(), "SKIPPED", null, null);
        }
        if (request.version() != item.getVersion()) {
            throw bad("IMPORT_ITEM_VERSION_CONFLICT", "Kết quả đã thay đổi, vui lòng tải lại batch");
        }
        if (!request.selected() || request.resolution() == InvestmentImportResolution.SKIP) {
            item.setProcessingAction(InvestmentProcessingAction.IGNORE);
            item.setResolution(InvestmentImportResolution.SKIP);
            item.setUpdatedBy(userId);
            return new ConfirmItemResult(item.getItemId(), "SKIPPED", null, null);
        }

        InvestmentTransactionType type = request.transactionType();
        InvestmentTransactionStatus status = request.transactionStatus();
        BigDecimal amount = normalization.amount(request.amount());
        String currency = normalization.currency(request.currency());
        String externalId = normalization.externalId(request.externalTransactionId());
        String description = trim(request.description());
        validate(account, type, status, amount, currency, request.transactionAt());

        boolean saveAsNew = request.resolution() == InvestmentImportResolution.SAVE_AS_NEW;
        Candidate candidate = new Candidate(item.getItemId(), accountId, account.getCurrency(), type, status,
            amount, currency, request.transactionAt(), externalId, BigDecimal.ONE, List.of());
        var decision = deduplication.decide(candidate, saveAsNew);

        if (decision.action() == InvestmentProcessingAction.REVIEW
            && request.resolution() != InvestmentImportResolution.MERGE_EXISTING && !saveAsNew) {
            throw bad("IMPORT_CONFLICT_REQUIRES_RESOLUTION", "Giao dịch xung đột cần chọn cách xử lý");
        }
        if (saveAsNew && externalId != null && decision.matchedTransactionId() != null) {
            throw bad("EXTERNAL_TRANSACTION_ID_ALREADY_EXISTS",
                "Không thể lưu mới khi mã giao dịch đã tồn tại; hãy xóa mã hoặc gộp bản ghi");
        }

        copyReviewedValues(item, type, status, amount, currency, request.transactionAt(), externalId, description,
            decision.deduplicationKey(), request.resolution(), userId);
        if (request.resolution() == InvestmentImportResolution.MERGE_EXISTING) {
            Long existingId = decision.matchedTransactionId() != null
                ? decision.matchedTransactionId() : item.getMatchedTransactionId();
            if (existingId == null) throw bad("IMPORT_MERGE_TARGET_NOT_FOUND", "Không tìm thấy giao dịch để gộp");
            return mergeExisting(userId, item, existingId, status, description);
        }
        if (decision.action() == InvestmentProcessingAction.UPDATE) {
            return mergeExisting(userId, item, decision.matchedTransactionId(), status, description);
        }
        if (decision.action() == InvestmentProcessingAction.DUPLICATE) {
            item.setProcessingAction(InvestmentProcessingAction.DUPLICATE);
            item.setResolution(defaultResolution(request.resolution()));
            item.setMatchedTransactionId(decision.matchedTransactionId());
            item.setConfirmedTransactionId(decision.matchedTransactionId());
            linkSources(item.getId(), decision.matchedTransactionId());
            return new ConfirmItemResult(item.getItemId(), "SKIPPED", decision.matchedTransactionId(), null);
        }

        Attachment source = attachments.findById(item.getPrimaryAttachmentId())
            .orElseThrow(() -> missing("ATTACHMENT_NOT_FOUND"));
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
        transaction.setRawText(item.getRawText());
        transaction.setAiExtractionData(item.getAiExtractionData());
        transaction.setAiConfidence(item.getAiConfidence());
        transaction.setDeduplicationKey(decision.deduplicationKey());
        transaction.setSourceFileHash(source.getSha256());
        transaction.setSourceAttachmentId(source.getId());
        transaction.setCreatedBy(userId);
        transaction.setUpdatedBy(userId);
        transactions.saveAndFlush(transaction);
        item.setProcessingAction(InvestmentProcessingAction.INSERT);
        item.setResolution(defaultResolution(request.resolution()));
        item.setConfirmedTransactionId(transaction.getId());
        linkSources(item.getId(), transaction.getId());
        return new ConfirmItemResult(item.getItemId(), "INSERTED", transaction.getId(), null);
    }

    private ConfirmItemResult mergeExisting(Long userId, InvestmentTransactionImportItem item, Long transactionId,
                                            InvestmentTransactionStatus requestedStatus, String description) {
        InvestmentAccountTransaction existing = transactions.findOwnedForUpdate(transactionId, userId)
            .orElseThrow(() -> missing("INVESTMENT_TRANSACTION_NOT_FOUND"));
        boolean updated = false;
        if (existing.getTransactionStatus() == InvestmentTransactionStatus.PENDING && requestedStatus.terminal()) {
            existing.setTransactionStatus(requestedStatus);
            updated = true;
        }
        if ((existing.getDescription() == null || existing.getDescription().isBlank()) && description != null) {
            existing.setDescription(description);
            updated = true;
        }
        if ((existing.getRawText() == null || existing.getRawText().length() < nullSafeLength(item.getRawText()))
            && item.getRawText() != null) {
            existing.setRawText(item.getRawText());
            updated = true;
        }
        if (item.getAiConfidence() != null && (existing.getAiConfidence() == null
            || item.getAiConfidence().compareTo(existing.getAiConfidence()) > 0)) {
            existing.setAiConfidence(item.getAiConfidence());
            existing.setAiExtractionData(item.getAiExtractionData());
            updated = true;
        }
        existing.setUpdatedBy(userId);
        item.setProcessingAction(updated ? InvestmentProcessingAction.UPDATE : InvestmentProcessingAction.DUPLICATE);
        item.setResolution(InvestmentImportResolution.MERGE_EXISTING);
        item.setMatchedTransactionId(existing.getId());
        item.setConfirmedTransactionId(existing.getId());
        linkSources(item.getId(), existing.getId());
        return new ConfirmItemResult(item.getItemId(), updated ? "UPDATED" : "SKIPPED", existing.getId(), null);
    }

    private void linkSources(Long itemDatabaseId, Long transactionId) {
        jdbc.update("""
            INSERT IGNORE INTO investment_account_transaction_sources(transaction_id, attachment_id)
            SELECT ?, attachment_id FROM investment_transaction_import_item_sources WHERE import_item_id = ?
            """, transactionId, itemDatabaseId);
    }

    private void copyReviewedValues(InvestmentTransactionImportItem item, InvestmentTransactionType type,
                                    InvestmentTransactionStatus status, BigDecimal amount, String currency,
                                    java.time.Instant transactionAt, String externalId, String description,
                                    byte[] deduplicationKey, InvestmentImportResolution resolution, Long userId) {
        item.setTransactionType(type);
        item.setTransactionStatus(status);
        item.setAmount(amount);
        item.setCurrency(currency);
        item.setTransactionAt(transactionAt);
        item.setExternalTransactionId(externalId);
        item.setDescription(description);
        item.setNormalizedDescription(normalization.description(description));
        item.setDeduplicationKey(deduplicationKey);
        item.setResolution(defaultResolution(resolution));
        item.setUpdatedBy(userId);
    }

    private void validate(InvestmentAccount account, InvestmentTransactionType type, InvestmentTransactionStatus status,
                          BigDecimal amount, String currency, java.time.Instant transactionAt) {
        if (type == null || status == null || amount == null || amount.signum() <= 0 || currency == null
            || transactionAt == null) {
            throw bad("INVALID_IMPORT_TRANSACTION", "Loại, trạng thái, số tiền, tiền tệ và thời gian là bắt buộc");
        }
        if (!Objects.equals(account.getCurrency(), currency)) {
            throw bad("INVESTMENT_CURRENCY_MISMATCH", "Tiền tệ giao dịch phải khớp với tài khoản");
        }
    }

    private InvestmentImportResolution defaultResolution(InvestmentImportResolution value) {
        return value == null ? InvestmentImportResolution.ACCEPT : value;
    }

    private int nullSafeLength(String value) {
        return value == null ? 0 : value.length();
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private ApiException missing(String code) {
        return new ApiException(HttpStatus.NOT_FOUND, code, "Không tìm thấy dữ liệu");
    }
}

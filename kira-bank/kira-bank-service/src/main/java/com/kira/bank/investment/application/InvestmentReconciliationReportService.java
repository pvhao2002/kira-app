package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.*;
import com.kira.bank.investment.infrastructure.InvestmentAccountRepository;
import com.kira.bank.investment.infrastructure.InvestmentAccountTransactionRepository;
import com.kira.bank.investment.infrastructure.InvestmentReconciliationReportEventRepository;
import com.kira.bank.investment.infrastructure.InvestmentReconciliationReportRepository;
import com.kira.bank.notification.application.NotificationService;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.bank.investment.application.InvestmentReconciliationReportDtos.*;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
public class InvestmentReconciliationReportService {
    private static final String REPORT_STATUS_NOTIFICATION = "INVESTMENT_REPORT_STATUS";
    private static final EnumSet<InvestmentReconciliationReportStatus> OPEN_STATUSES = EnumSet.of(
        InvestmentReconciliationReportStatus.OPEN,
        InvestmentReconciliationReportStatus.IN_REVIEW,
        InvestmentReconciliationReportStatus.NEEDS_INFO
    );

    private final InvestmentReconciliationReportRepository reports;
    private final InvestmentAccountRepository accounts;
    private final InvestmentAccountTransactionRepository transactions;
    private final InvestmentReconciliationReportEventRepository events;
    private final NotificationService notifications;

    @Transactional
    public ReportResponse create(Long userId, Long accountId, Long transactionId, CreateReportRequest request) {
        InvestmentAccount account = account(userId, accountId);
        InvestmentAccountTransaction transaction = transactions
            .findOwnedForUpdate(transactionId, userId)
            .filter(candidate -> accountId.equals(candidate.getInvestmentAccountId()))
            .orElseThrow(this::transactionMissing);
        if (reports.existsByUserIdAndTransactionIdAndStatusInAndDeletedAtIsNull(userId, transactionId, OPEN_STATUSES)) {
            throw conflict("INVESTMENT_REPORT_ALREADY_OPEN", "Giao dịch này đã có hồ sơ tra soát đang mở");
        }
        InvestmentReconciliationReport report = new InvestmentReconciliationReport();
        report.setUserId(userId);
        report.setInvestmentAccountId(accountId);
        report.setTransactionId(transactionId);
        report.setReason(request.reason());
        report.setDetail(request.detail().trim());
        report.setStatus(InvestmentReconciliationReportStatus.OPEN);
        report.setCreatedBy(userId);
        report.setUpdatedBy(userId);
        reports.saveAndFlush(report);
        appendEvent(report, null, InvestmentReconciliationReportStatus.OPEN, "Hồ sơ được tạo", userId);
        return response(report, account, transaction);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReportResponse> mine(Long userId, Pageable pageable) {
        Page<InvestmentReconciliationReport> page = reports.findByUserIdAndDeletedAtIsNull(userId, pageable);
        return page(page, userId, false);
    }

    @Transactional(readOnly = true)
    public ReportResponse mineOne(Long userId, Long reportId) {
        InvestmentReconciliationReport report = reports.findByIdAndUserIdAndDeletedAtIsNull(reportId, userId)
            .orElseThrow(this::reportMissing);
        return response(report, accountOrNull(userId, report.getInvestmentAccountId()), transactionOrNull(report, userId));
    }

    @Transactional(readOnly = true)
    public PageResponse<ReportResponse> all(Pageable pageable, InvestmentReconciliationReportStatus status) {
        // Separate queries so the status filter can use the (status, created_at) index.
        Page<InvestmentReconciliationReport> page = status == null
            ? reports.findByDeletedAtIsNull(pageable)
            : reports.findByStatusAndDeletedAtIsNull(status, pageable);
        return page(page, null, true);
    }

    @Transactional
    public ReportResponse updateStatus(Long adminId, Long reportId, UpdateReportStatusRequest request) {
        InvestmentReconciliationReport report = reports.findForUpdate(reportId).orElseThrow(this::reportMissing);
        if (report.getVersion() != request.version()) {
            throw conflict("INVESTMENT_REPORT_VERSION_CONFLICT", "Hồ sơ tra soát đã thay đổi ở nơi khác");
        }
        if (report.getStatus().closed() && report.getStatus() != request.status()) {
            throw conflict("INVESTMENT_REPORT_CLOSED", "Hồ sơ tra soát đã được đóng");
        }
        InvestmentReconciliationReportStatus previousStatus = report.getStatus();
        String previousNote = report.getResolutionNote();
        report.setStatus(request.status());
        report.setResolutionNote(trim(request.resolutionNote()));
        report.setResolvedAt(request.status().closed() ? Instant.now() : null);
        report.setUpdatedBy(adminId);
        reports.flush();
        if (previousStatus != report.getStatus() || !Objects.equals(previousNote, report.getResolutionNote())) {
            appendEvent(report, previousStatus, report.getStatus(), report.getResolutionNote(), adminId);
            notifications.createIfAbsent(report.getUserId(), REPORT_STATUS_NOTIFICATION, "INVESTMENT",
                "Cập nhật hồ sơ tra soát",
                "Hồ sơ tra soát #" + report.getId() + " đã chuyển sang " + statusLabel(report.getStatus()) + ".",
                report.getStatus().closed() ? "SUCCESS" : "INFO",
                "/investment-report-detail?id=" + report.getId() + "&status=" + report.getStatus().name() + "&version=" + report.getVersion());
        }
        return response(report, accountOrNull(report.getUserId(), report.getInvestmentAccountId()),
            transactionOrNull(report, report.getUserId()));
    }

    private PageResponse<ReportResponse> page(Page<InvestmentReconciliationReport> page, Long userId, boolean admin) {
        List<InvestmentReconciliationReport> content = page.getContent();
        // Batch-load related rows, then apply the same ownership filters as accountOrNull/transactionOrNull in memory.
        Map<Long, InvestmentAccount> accountsById = byId(accounts.findAllById(ids(content,
            InvestmentReconciliationReport::getInvestmentAccountId)), InvestmentAccount::getId);
        Map<Long, InvestmentAccountTransaction> transactionsById = byId(transactions.findAllById(ids(content,
            InvestmentReconciliationReport::getTransactionId)), InvestmentAccountTransaction::getId);
        Map<Long, List<InvestmentReconciliationReportEvent>> eventsByReport = content.isEmpty() ? Map.of()
            : events.findByReportIdInOrderByReportIdAscCreatedAtAscIdAsc(ids(content, InvestmentReconciliationReport::getId))
            .stream().collect(Collectors.groupingBy(InvestmentReconciliationReportEvent::getReportId));
        List<ReportResponse> data = content.stream().map(report -> {
            Long ownerId = admin ? report.getUserId() : userId;
            InvestmentAccount account = ownerId == null || report.getInvestmentAccountId() == null ? null
                : accountsById.get(report.getInvestmentAccountId());
            if (account != null && (!ownerId.equals(account.getUserId()) || account.getDeletedAt() != null)) account = null;
            InvestmentAccountTransaction transaction = ownerId == null || report.getTransactionId() == null ? null
                : transactionsById.get(report.getTransactionId());
            if (transaction != null && (!ownerId.equals(transaction.getUserId())
                || !Objects.equals(report.getInvestmentAccountId(), transaction.getInvestmentAccountId())
                || transaction.getDeletedAt() != null)) transaction = null;
            return response(report, account, transaction, eventsByReport.getOrDefault(report.getId(), List.of()));
        }).toList();
        return new PageResponse<>(data, new PageMeta(page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    private List<Long> ids(List<InvestmentReconciliationReport> content, Function<InvestmentReconciliationReport, Long> id) {
        return content.stream().map(id).filter(Objects::nonNull).distinct().toList();
    }

    private <T> Map<Long, T> byId(List<T> rows, Function<T, Long> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity()));
    }

    private InvestmentAccount account(Long userId, Long accountId) {
        return accounts.findByIdAndUserIdAndDeletedAtIsNull(accountId, userId).orElseThrow(this::accountMissing);
    }

    private InvestmentAccount accountOrNull(Long userId, Long accountId) {
        if (userId == null || accountId == null) return null;
        return accounts.findByIdAndUserIdAndDeletedAtIsNull(accountId, userId).orElse(null);
    }

    private InvestmentAccountTransaction transactionOrNull(InvestmentReconciliationReport report, Long userId) {
        if (userId == null) return null;
        return transactions.findByIdAndUserIdAndInvestmentAccountIdAndDeletedAtIsNull(
            report.getTransactionId(), userId, report.getInvestmentAccountId()).orElse(null);
    }

    private ReportResponse response(InvestmentReconciliationReport report, InvestmentAccount account,
                                    InvestmentAccountTransaction transaction) {
        return response(report, account, transaction, events.findByReportIdOrderByCreatedAtAscIdAsc(report.getId()));
    }

    private ReportResponse response(InvestmentReconciliationReport report, InvestmentAccount account,
                                    InvestmentAccountTransaction transaction,
                                    List<InvestmentReconciliationReportEvent> reportEvents) {
        List<ReportEventResponse> history = reportEvents.stream()
            .map(event -> new ReportEventResponse(event.getFromStatus(), event.getToStatus(), event.getNote(), event.getCreatedAt()))
            .toList();
        return new ReportResponse(report.getId(), report.getInvestmentAccountId(),
            account == null ? null : account.getAccountName(), report.getTransactionId(),
            transaction == null ? null : transaction.getTransactionType(),
            transaction == null ? null : transaction.getTransactionStatus(),
            transaction == null ? null : transaction.getAmount(),
            transaction == null ? null : transaction.getCurrency(),
            transaction == null ? null : transaction.getTransactionAt(),
            transaction == null ? null : transaction.getExternalTransactionId(),
            transaction == null ? null : transaction.getSourceAttachmentId(),
            report.getReason(), report.getDetail(), report.getStatus(), report.getResolutionNote(),
            report.getCreatedAt(), report.getResolvedAt(), report.getVersion(), history);
    }

    private void appendEvent(InvestmentReconciliationReport report, InvestmentReconciliationReportStatus fromStatus,
                             InvestmentReconciliationReportStatus toStatus, String note, Long actorId) {
        InvestmentReconciliationReportEvent event = new InvestmentReconciliationReportEvent();
        event.setReportId(report.getId());
        event.setFromStatus(fromStatus);
        event.setToStatus(toStatus);
        event.setNote(trim(note));
        event.setCreatedAt(Instant.now());
        event.setActorId(actorId);
        events.save(event);
    }

    private String statusLabel(InvestmentReconciliationReportStatus status) {
        return switch (status) {
            case OPEN -> "Mở";
            case IN_REVIEW -> "Đang tra soát";
            case NEEDS_INFO -> "Cần bổ sung";
            case RESOLVED -> "Đã giải quyết";
            case REJECTED -> "Từ chối";
        };
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private ApiException accountMissing() {
        return new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản đầu tư");
    }

    private ApiException transactionMissing() {
        return new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_TRANSACTION_NOT_FOUND", "Không tìm thấy giao dịch đầu tư");
    }

    private ApiException reportMissing() {
        return new ApiException(HttpStatus.NOT_FOUND, "INVESTMENT_REPORT_NOT_FOUND", "Không tìm thấy hồ sơ tra soát");
    }

    private ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
}

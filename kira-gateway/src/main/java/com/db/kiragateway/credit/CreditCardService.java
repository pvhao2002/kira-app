package com.db.kiragateway.credit;

import com.db.kiragateway.credit.CreditCardRepository.CreditCardSummaryAgg;
import com.db.kiragateway.credit.dto.CreateCreditCardRequest;
import com.db.kiragateway.credit.dto.CreatePaymentRequest;
import com.db.kiragateway.credit.dto.CreditCardPaymentResponse;
import com.db.kiragateway.credit.dto.CreditCardResponse;
import com.db.kiragateway.credit.dto.CreditCardSummaryResponse;
import com.db.kiragateway.credit.dto.PatchCycleRequest;
import com.db.kiragateway.credit.dto.PaymentPageResponse;
import com.db.kiragateway.credit.dto.UpdateCreditCardRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class CreditCardService {

    private static final DateTimeFormatter REMINDER_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final CreditCardRepository repo;

    public CreditCardService(CreditCardRepository repo) {
        this.repo = repo;
    }

    public CreditCardSummaryResponse summary(int userId) {
        CreditCardSummaryAgg a = repo.summary(userId);
        return new CreditCardSummaryResponse(a.totalOutstanding(), a.count());
    }

    public List<CreditCardResponse> list(int userId) {
        return repo.findAllByUserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    public CreditCardResponse get(int userId, long creditCardId) {
        var row = repo.findByIdAndUserId(creditCardId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));
        return toResponse(row);
    }

    public CreditCardResponse create(int userId, CreateCreditCardRequest req) {
        LocalTime reminder = LocalTime.parse(req.reminderTime().trim(), REMINDER_FMT);
        String lastFour = normalizeLastFour(req.lastFour());
        LocalDateTime now = LocalDateTime.now();
        var row = new CreditCardRow(
                0L,
                userId,
                req.bankName().trim(),
                req.cardLabel().trim(),
                lastFour,
                req.creditLimit(),
                req.outstandingBalance(),
                req.cardholderName().trim(),
                req.statementDay(),
                req.paymentDueDay(),
                reminder,
                false,
                false,
                now,
                now
        );
        long id = repo.insert(row);
        var inserted = repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalStateException("insert failed"));
        return toResponse(inserted);
    }

    public CreditCardResponse update(int userId, long creditCardId, UpdateCreditCardRequest req) {
        var existing = repo.findByIdAndUserId(creditCardId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));

        String bankName = req.bankName() != null ? req.bankName().trim() : existing.bankName();
        String cardLabel = req.cardLabel() != null ? req.cardLabel().trim() : existing.cardLabel();
        String lastFour = existing.lastFour();
        if (req.lastFour() != null) {
            lastFour = normalizeLastFour(req.lastFour());
        }
        var creditLimit = req.creditLimit() != null ? req.creditLimit() : existing.creditLimit();
        var outstanding = req.outstandingBalance() != null ? req.outstandingBalance() : existing.outstandingBalance();
        String holder = req.cardholderName() != null ? req.cardholderName().trim() : existing.cardholderName();
        int stmtDay = req.statementDay() != null ? req.statementDay() : existing.statementDay();
        int dueDay = req.paymentDueDay() != null ? req.paymentDueDay() : existing.paymentDueDay();
        LocalTime reminder = existing.reminderTime();
        if (req.reminderTime() != null && !req.reminderTime().isBlank()) {
            reminder = LocalTime.parse(req.reminderTime().trim(), REMINDER_FMT);
        }
        boolean stmtDone = req.cycleStatementDone() != null ? req.cycleStatementDone() : existing.cycleStatementDone();
        boolean duePaid = req.cycleDuePaid() != null ? req.cycleDuePaid() : existing.cycleDuePaid();

        var merged = new CreditCardRow(
                existing.creditCardId(),
                existing.userId(),
                bankName,
                cardLabel,
                lastFour,
                creditLimit,
                outstanding,
                holder,
                stmtDay,
                dueDay,
                reminder,
                stmtDone,
                duePaid,
                existing.createdAt(),
                LocalDateTime.now()
        );
        int n = repo.update(merged);
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found");
        }
        return toResponse(repo.findByIdAndUserId(creditCardId, userId).orElseThrow());
    }

    public void patchCycle(int userId, long creditCardId, PatchCycleRequest req) {
        if (req.cycleStatementDone() == null && req.cycleDuePaid() == null) {
            return;
        }
        repo.findByIdAndUserId(creditCardId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));
        repo.updateCycleFlags(creditCardId, userId, req.cycleStatementDone(), req.cycleDuePaid());
    }

    public void delete(int userId, long creditCardId) {
        int n = repo.delete(creditCardId, userId);
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found");
        }
    }

    public PaymentPageResponse payments(int userId, long creditCardId, int page, int size) {
        repo.findByIdAndUserId(creditCardId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        long total = repo.countPayments(creditCardId, userId);
        int totalPages = safeSize == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        var rows = repo.findPaymentsPage(creditCardId, userId, safePage * safeSize, safeSize);
        var content = rows.stream()
                .map(r -> new CreditCardPaymentResponse(
                        r.paymentId(),
                        r.paidAt(),
                        r.amount(),
                        r.note(),
                        r.createdAt()
                ))
                .toList();
        return new PaymentPageResponse(content, safePage, safeSize, total, totalPages);
    }

    public CreditCardPaymentResponse addPayment(int userId, long creditCardId, CreatePaymentRequest req) {
        repo.findByIdAndUserId(creditCardId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));
        String note = req.note() != null && !req.note().isBlank() ? req.note().trim() : null;
        long pid = repo.insertPayment(creditCardId, userId, req.paidAt(), req.amount(), note);
        var row = repo.findPayment(pid, creditCardId, userId)
                .orElseThrow(() -> new IllegalStateException("payment insert not readable"));
        return new CreditCardPaymentResponse(row.paymentId(), row.paidAt(), row.amount(), row.note(), row.createdAt());
    }

    public void deletePayment(int userId, long creditCardId, long paymentId) {
        repo.findByIdAndUserId(creditCardId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found"));
        int n = repo.deletePayment(paymentId, creditCardId, userId);
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found");
        }
    }

    private CreditCardResponse toResponse(CreditCardRow row) {
        LocalDate today = LocalDate.now();
        LocalDate nextStmt = CreditCardScheduleUtil.nextOccurrenceOfDay(today, row.statementDay());
        LocalDate nextDue = CreditCardScheduleUtil.nextOccurrenceOfDay(today, row.paymentDueDay());
        long daysUntil = CreditCardScheduleUtil.daysUntil(today, nextDue);
        String reminder = String.format("%02d:%02d", row.reminderTime().getHour(), row.reminderTime().getMinute());
        return new CreditCardResponse(
                row.creditCardId(),
                row.bankName(),
                row.cardLabel(),
                row.lastFour() != null ? row.lastFour() : "",
                row.creditLimit(),
                row.outstandingBalance(),
                row.cardholderName(),
                row.statementDay(),
                row.paymentDueDay(),
                reminder,
                row.cycleStatementDone(),
                row.cycleDuePaid(),
                CreditCardScheduleUtil.formatDdMm(nextStmt),
                CreditCardScheduleUtil.formatDdMm(nextDue),
                daysUntil,
                row.createdAt(),
                row.updatedAt()
        );
    }

    private static String normalizeLastFour(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }
}

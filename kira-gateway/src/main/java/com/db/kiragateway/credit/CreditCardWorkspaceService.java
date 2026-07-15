package com.db.kiragateway.credit;

import com.db.kiragateway.credit.CreditCardWorkspaceRepository.CashbackRow;
import com.db.kiragateway.credit.CreditCardWorkspaceRepository.MccRow;
import com.db.kiragateway.credit.CreditCardWorkspaceRepository.RuleRow;
import com.db.kiragateway.credit.CreditCardWorkspaceRepository.StatementRow;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CashbackRuleInput;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CashbackRuleResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CashbackTransactionPageResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CashbackTransactionResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CreateCashbackTransactionRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CreateMccCategoryRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CreateStatementCycleRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.MccCategoryResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.OverviewResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.OverviewSummary;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.ReceiveCashbackRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.StatementCyclePageResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.StatementCycleResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.UpdateCashbackRuleRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.UpdateCashbackTransactionRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.UpdateMccCategoryRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.UpdateStatementCycleRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;

@Service
public class CreditCardWorkspaceService {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final CreditCardWorkspaceRepository repo;
    private final CreditCardRepository cardRepo;
    private final CreditCardService cardService;

    public CreditCardWorkspaceService(CreditCardWorkspaceRepository repo,
                                      CreditCardRepository cardRepo,
                                      CreditCardService cardService) {
        this.repo = repo;
        this.cardRepo = cardRepo;
        this.cardService = cardService;
    }

    public OverviewResponse overview(int userId, YearMonth month) {
        YearMonth selected = month != null ? month : YearMonth.now();
        LocalDate monthStart = selected.atDay(1);
        var money = repo.workspaceSummary(userId, monthStart, monthStart.plusMonths(1));
        var cardSummary = cardRepo.summary(userId);
        var latestStatements = new ArrayList<StatementCycleResponse>();
        var cardsWithStatement = new HashSet<Long>();
        for (var statement : repo.findStatementCycles(userId, null, null)) {
            if (cardsWithStatement.add(statement.creditCardId())) {
                latestStatements.add(toStatementResponse(statement));
            }
        }
        var dueStatements = repo.findDueStatements(userId, LocalDate.now().plusDays(45), 6).stream()
                .map(this::toStatementResponse)
                .toList();
        var recent = repo.findCashbackTransactions(userId, null, null, null, null, null, 0, 5).stream()
                .map(this::toCashbackResponse)
                .toList();
        var mcc = repo.findMccCategories(userId, true).stream().limit(5).map(row -> toMccResponse(userId, row)).toList();
        return new OverviewResponse(
                new OverviewSummary(cardSummary.totalOutstanding(), money.pendingCashback(), money.investedCost(),
                        money.realizedNet(), cardSummary.count(), money.pendingCount()),
                cardService.list(userId),
                latestStatements,
                dueStatements,
                recent,
                mcc
        );
    }

    public CashbackTransactionPageResponse cashbackTransactions(int userId, Long cardId, Long categoryId,
                                                                 String status, LocalDate from, LocalDate to,
                                                                 int page, int size) {
        String normalizedStatus = normalizeCashbackStatus(status);
        int safeSize = safeSize(size);
        int safePage = Math.max(page, 0);
        long total = repo.countCashbackTransactions(userId, cardId, categoryId, normalizedStatus, from, to);
        var content = repo.findCashbackTransactions(userId, cardId, categoryId, normalizedStatus, from, to,
                        safePage * safeSize, safeSize).stream()
                .map(this::toCashbackResponse)
                .toList();
        return new CashbackTransactionPageResponse(content, safePage, safeSize, total, totalPages(total, safeSize));
    }

    public CashbackTransactionResponse cashbackTransaction(int userId, long transactionId) {
        return toCashbackResponse(requireCashback(userId, transactionId));
    }

    @Transactional
    public CashbackTransactionResponse createCashbackTransaction(int userId, CreateCashbackTransactionRequest req) {
        requireCard(userId, req.creditCardId());
        var calculated = calculateCashback(userId, 0L, req.creditCardId(), req.mccCategoryId(), req.transactionDate(),
                req.spendAmount(), req.discountRate(), req.manualCashbackRate(), null);
        var row = new CashbackRow(0L, userId, req.creditCardId(), req.mccCategoryId(), null, null, null, null, null,
                req.transactionDate(), clean(req.customerName()), clean(req.billReference()), clean(req.description()),
                req.spendAmount(), req.discountRate(), calculated.discountAmount(), calculated.cashbackRate(),
                calculated.monthlyCap(), calculated.expectedCashback(), null, req.cashbackDueDate(), null,
                "PENDING", clean(req.note()), null, null);
        long id = repo.insertCashbackTransaction(row);
        return cashbackTransaction(userId, id);
    }

    @Transactional
    public CashbackTransactionResponse updateCashbackTransaction(int userId, long transactionId,
                                                                  UpdateCashbackTransactionRequest req) {
        var existing = requireCashback(userId, transactionId);
        if (!"PENDING".equals(existing.status())) {
            throw conflict("Only pending transactions can be edited");
        }
        long cardId = req.creditCardId() != null ? req.creditCardId() : existing.creditCardId();
        Long categoryId = req.mccCategoryId() != null ? req.mccCategoryId() : existing.mccCategoryId();
        LocalDate txDate = req.transactionDate() != null ? req.transactionDate() : existing.transactionDate();
        BigDecimal spend = req.spendAmount() != null ? req.spendAmount() : existing.spendAmount();
        BigDecimal discountRate = req.discountRate() != null ? req.discountRate() : existing.discountRate();
        requireCard(userId, cardId);
        var calculated = calculateCashback(userId, transactionId, cardId, categoryId, txDate, spend, discountRate,
                req.manualCashbackRate(), existing.cashbackRate());
        var merged = new CashbackRow(transactionId, userId, cardId, categoryId, null, null, null, null, null,
                txDate,
                req.customerName() != null ? clean(req.customerName()) : existing.customerName(),
                req.billReference() != null ? clean(req.billReference()) : existing.billReference(),
                req.description() != null ? clean(req.description()) : existing.description(),
                spend, discountRate, calculated.discountAmount(), calculated.cashbackRate(), calculated.monthlyCap(),
                calculated.expectedCashback(), null,
                req.cashbackDueDate() != null ? req.cashbackDueDate() : existing.cashbackDueDate(), null,
                "PENDING", req.note() != null ? clean(req.note()) : existing.note(), existing.createdAt(), null);
        if (repo.updateCashbackTransaction(merged) == 0) {
            throw conflict("Transaction is no longer pending");
        }
        return cashbackTransaction(userId, transactionId);
    }

    @Transactional
    public CashbackTransactionResponse receiveCashback(int userId, long transactionId, ReceiveCashbackRequest req) {
        var existing = requireCashback(userId, transactionId);
        if (!"PENDING".equals(existing.status())) {
            throw conflict("Transaction is no longer pending");
        }
        if (req.receivedAt().isBefore(existing.transactionDate())) {
            throw badRequest("receivedAt cannot be before transactionDate");
        }
        if (repo.receiveCashback(userId, transactionId, req.actualCashbackAmount(), req.receivedAt()) == 0) {
            throw conflict("Transaction is no longer pending");
        }
        return cashbackTransaction(userId, transactionId);
    }

    @Transactional
    public CashbackTransactionResponse cancelCashback(int userId, long transactionId) {
        requireCashback(userId, transactionId);
        if (repo.cancelCashback(userId, transactionId) == 0) {
            throw conflict("Only pending transactions can be cancelled");
        }
        return cashbackTransaction(userId, transactionId);
    }

    public StatementCyclePageResponse statementCycles(int userId, Long cardId, String status,
                                                       YearMonth month, int page, int size) {
        if (cardId != null) {
            requireCard(userId, cardId);
        }
        String normalizedStatus = normalizeStatementStatus(status);
        LocalDate cycleMonth = month != null ? month.atDay(1) : null;
        var filtered = repo.findStatementCycles(userId, cardId, cycleMonth).stream()
                .map(this::toStatementResponse)
                .filter(item -> normalizedStatus == null || normalizedStatus.equals(item.status()))
                .toList();
        int safeSize = safeSize(size);
        int safePage = Math.max(page, 0);
        int fromIndex = Math.min(safePage * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        return new StatementCyclePageResponse(filtered.subList(fromIndex, toIndex), safePage, safeSize,
                filtered.size(), totalPages(filtered.size(), safeSize));
    }

    @Transactional
    public StatementCycleResponse createStatementCycle(int userId, long cardId, CreateStatementCycleRequest req) {
        var card = requireCard(userId, cardId);
        LocalDate cycleMonth = req.cycleMonth().atDay(1);
        LocalDate statementDate = req.statementDate() != null
                ? req.statementDate() : dayInMonth(req.cycleMonth(), card.statementDay());
        LocalDate dueDate = req.dueDate() != null
                ? req.dueDate() : nextPaymentDate(statementDate, card.paymentDueDay());
        validateStatement(statementDate, dueDate, req.statementAmount(), req.statementIssuedAt());
        var row = new StatementRow(0L, userId, cardId, null, null, null, cycleMonth, statementDate, dueDate,
                req.statementAmount(), BigDecimal.ZERO, req.statementIssuedAt(), clean(req.note()), null, null);
        try {
            long id = repo.insertStatementCycle(row);
            return toStatementResponse(repo.findStatementCycle(userId, cardId, id).orElseThrow());
        } catch (DuplicateKeyException ex) {
            throw conflict("A statement cycle already exists for this card and month");
        }
    }

    @Transactional
    public StatementCycleResponse updateStatementCycle(int userId, long cardId, long cycleId,
                                                        UpdateStatementCycleRequest req) {
        var existing = repo.findStatementCycle(userId, cardId, cycleId)
                .orElseThrow(() -> notFound("Statement cycle not found"));
        LocalDate statementDate = req.statementDate() != null ? req.statementDate() : existing.statementDate();
        LocalDate dueDate = req.dueDate() != null ? req.dueDate() : existing.dueDate();
        BigDecimal amount = req.statementAmount() != null ? req.statementAmount() : existing.statementAmount();
        LocalDateTime issuedAt = req.statementIssuedAt() != null ? req.statementIssuedAt() : existing.statementIssuedAt();
        validateStatement(statementDate, dueDate, amount, issuedAt);
        var merged = new StatementRow(cycleId, userId, cardId, existing.cardLabel(), existing.bankName(),
                existing.lastFour(), existing.cycleMonth(), statementDate, dueDate, amount, existing.paidAmount(),
                issuedAt, req.note() != null ? clean(req.note()) : existing.note(), existing.createdAt(), null);
        repo.updateStatementCycle(merged);
        return toStatementResponse(repo.findStatementCycle(userId, cardId, cycleId).orElseThrow());
    }

    public List<MccCategoryResponse> mccCategories(int userId, boolean activeOnly) {
        return repo.findMccCategories(userId, activeOnly).stream().map(row -> toMccResponse(userId, row)).toList();
    }

    @Transactional
    public MccCategoryResponse createMccCategory(int userId, CreateMccCategoryRequest req) {
        long categoryId;
        try {
            categoryId = repo.insertMccCategory(userId, req.mccCode().trim(), req.categoryName().trim(), clean(req.description()));
        } catch (DuplicateKeyException ex) {
            throw conflict("MCC code already exists");
        }
        if (req.rules() != null) {
            for (var rule : req.rules()) {
                createRuleInternal(userId, categoryId, rule);
            }
        }
        return toMccResponse(userId, repo.findMccCategory(userId, categoryId).orElseThrow());
    }

    @Transactional
    public MccCategoryResponse updateMccCategory(int userId, long categoryId, UpdateMccCategoryRequest req) {
        var existing = requireMcc(userId, categoryId);
        String code = req.mccCode() != null ? req.mccCode().trim() : existing.mccCode();
        String name = req.categoryName() != null ? req.categoryName().trim() : existing.categoryName();
        boolean active = req.active() != null ? req.active() : existing.active();
        try {
            repo.updateMccCategory(userId, categoryId, code, name,
                    req.description() != null ? clean(req.description()) : existing.description(), active);
        } catch (DuplicateKeyException ex) {
            throw conflict("MCC code already exists");
        }
        return toMccResponse(userId, requireMcc(userId, categoryId));
    }

    @Transactional
    public void deactivateMccCategory(int userId, long categoryId) {
        requireMcc(userId, categoryId);
        repo.deactivateMccCategory(userId, categoryId);
    }

    public List<CashbackRuleResponse> rulesForCard(int userId, long cardId) {
        requireCard(userId, cardId);
        return repo.findRulesByCard(userId, cardId).stream().map(this::toRuleResponse).toList();
    }

    @Transactional
    public CashbackRuleResponse createRule(int userId, long cardId, long categoryId, CashbackRuleInput req) {
        if (req.creditCardId() != cardId) {
            throw badRequest("creditCardId must match the route");
        }
        long id = createRuleInternal(userId, categoryId, req);
        return toRuleResponse(repo.findRule(userId, id).orElseThrow());
    }

    @Transactional
    public CashbackRuleResponse updateRule(int userId, long cardId, long ruleId, UpdateCashbackRuleRequest req) {
        var existing = repo.findRule(userId, ruleId).orElseThrow(() -> notFound("Cashback rule not found"));
        if (existing.creditCardId() != cardId) {
            throw notFound("Cashback rule not found");
        }
        BigDecimal rate = req.cashbackRate() != null ? req.cashbackRate() : existing.cashbackRate();
        BigDecimal cap = req.monthlyCapAmount() != null ? req.monthlyCapAmount() : existing.monthlyCap();
        LocalDate from = req.effectiveFrom() != null ? req.effectiveFrom() : existing.effectiveFrom();
        LocalDate to = req.effectiveTo() != null ? req.effectiveTo() : existing.effectiveTo();
        boolean active = req.active() != null ? req.active() : existing.active();
        validateRuleDates(from, to);
        if (active && repo.hasOverlappingRule(userId, cardId, existing.categoryId(), from, to, ruleId)) {
            throw conflict("Cashback rule overlaps another active rule");
        }
        repo.updateRule(userId, ruleId, rate, cap, from, to, active,
                req.note() != null ? clean(req.note()) : existing.note());
        return toRuleResponse(repo.findRule(userId, ruleId).orElseThrow());
    }

    @Transactional
    public void deactivateRule(int userId, long cardId, long ruleId) {
        var existing = repo.findRule(userId, ruleId).orElseThrow(() -> notFound("Cashback rule not found"));
        if (existing.creditCardId() != cardId) {
            throw notFound("Cashback rule not found");
        }
        repo.deactivateRule(userId, ruleId);
    }

    public void verifyStatementOwnership(int userId, long cardId, Long cycleId) {
        if (cycleId == null) {
            return;
        }
        repo.findStatementCycle(userId, cardId, cycleId)
                .orElseThrow(() -> badRequest("Statement cycle does not belong to this card"));
    }

    private long createRuleInternal(int userId, long categoryId, CashbackRuleInput req) {
        requireCard(userId, req.creditCardId());
        requireMcc(userId, categoryId);
        validateRuleDates(req.effectiveFrom(), req.effectiveTo());
        if (repo.hasOverlappingRule(userId, req.creditCardId(), categoryId,
                req.effectiveFrom(), req.effectiveTo(), null)) {
            throw conflict("Cashback rule overlaps another active rule");
        }
        try {
            return repo.insertRule(userId, req.creditCardId(), categoryId, req.cashbackRate(),
                    req.monthlyCapAmount(), req.effectiveFrom(), req.effectiveTo(), clean(req.note()));
        } catch (DuplicateKeyException ex) {
            throw conflict("Cashback rule already exists for this effective date");
        }
    }

    private Calculation calculateCashback(int userId, long transactionId, long cardId, Long categoryId,
                                          LocalDate transactionDate, BigDecimal spend, BigDecimal discountRate,
                                          BigDecimal manualRate, BigDecimal fallbackRate) {
        BigDecimal cashbackRate = manualRate != null ? manualRate : fallbackRate;
        BigDecimal cap = null;
        RuleRow rule = null;
        if (categoryId != null) {
            requireMcc(userId, categoryId);
            rule = repo.findActiveRule(userId, cardId, categoryId, transactionDate).orElse(null);
        }
        if (rule != null) {
            cashbackRate = rule.cashbackRate();
            cap = rule.monthlyCap();
        }
        if (cashbackRate == null) {
            cashbackRate = BigDecimal.ZERO;
        }
        BigDecimal discountAmount = percentage(spend, discountRate);
        BigDecimal expected = percentage(spend, cashbackRate);
        if (cap != null && categoryId != null) {
            LocalDate start = YearMonth.from(transactionDate).atDay(1);
            BigDecimal used = repo.monthExpectedCashback(userId, cardId, categoryId, start, start.plusMonths(1),
                    transactionId > 0 ? transactionId : null);
            BigDecimal remaining = cap.subtract(used).max(BigDecimal.ZERO);
            expected = expected.min(remaining);
        }
        return new Calculation(discountAmount, cashbackRate, cap, expected);
    }

    private MccCategoryResponse toMccResponse(int userId, MccRow row) {
        var rules = repo.findRulesByCategory(userId, row.mccCategoryId()).stream().map(this::toRuleResponse).toList();
        return new MccCategoryResponse(row.mccCategoryId(), row.mccCode(), row.categoryName(), row.description(),
                row.active(), row.activeRuleCount(), row.bestCashbackRate(), rules, row.createdAt(), row.updatedAt());
    }

    private CashbackRuleResponse toRuleResponse(RuleRow row) {
        return new CashbackRuleResponse(row.ruleId(), row.creditCardId(), row.cardLabel(), row.bankName(),
                safe(row.lastFour()), row.categoryId(), row.mccCode(), row.categoryName(), row.cashbackRate(),
                row.monthlyCap(), row.effectiveFrom(), row.effectiveTo(), row.active(), row.note(),
                row.createdAt(), row.updatedAt());
    }

    private CashbackTransactionResponse toCashbackResponse(CashbackRow row) {
        BigDecimal projected = row.expectedCashback().subtract(row.discountAmount());
        BigDecimal realized = row.actualCashback() != null
                ? row.actualCashback().subtract(row.discountAmount()) : null;
        return new CashbackTransactionResponse(row.transactionId(), row.creditCardId(), row.cardLabel(), row.bankName(),
                safe(row.lastFour()), row.mccCategoryId(), row.mccCode(), row.mccCategoryName(), row.transactionDate(),
                row.customerName(), row.billReference(), row.description(), row.spendAmount(), row.discountRate(),
                row.discountAmount(), row.cashbackRate(), row.monthlyCap(), row.expectedCashback(),
                row.actualCashback(), projected, realized, row.cashbackDueDate(), row.cashbackReceivedAt(),
                row.status(), row.note(), row.createdAt(), row.updatedAt());
    }

    private StatementCycleResponse toStatementResponse(StatementRow row) {
        BigDecimal amount = row.statementAmount();
        BigDecimal paid = row.paidAmount() != null ? row.paidAmount() : BigDecimal.ZERO;
        BigDecimal remaining = amount != null ? amount.subtract(paid).max(BigDecimal.ZERO) : BigDecimal.ZERO;
        String status;
        if (row.statementIssuedAt() == null || amount == null) {
            status = "NOT_ISSUED";
        } else if (paid.compareTo(amount) >= 0) {
            status = "PAID";
        } else if (LocalDate.now().isAfter(row.dueDate())) {
            status = "OVERDUE";
        } else if (paid.signum() > 0) {
            status = "PARTIALLY_PAID";
        } else {
            status = "UNPAID";
        }
        long days = ChronoUnit.DAYS.between(LocalDate.now(), row.dueDate());
        return new StatementCycleResponse(row.statementCycleId(), row.creditCardId(), row.cardLabel(), row.bankName(),
                safe(row.lastFour()), row.cycleMonth(), row.statementDate(), row.dueDate(), amount, paid, remaining,
                row.statementIssuedAt(), status, days, row.note(), row.createdAt(), row.updatedAt());
    }

    private CreditCardRow requireCard(int userId, long cardId) {
        return cardRepo.findByIdAndUserId(cardId, userId)
                .orElseThrow(() -> notFound("Card not found"));
    }

    private MccRow requireMcc(int userId, long categoryId) {
        return repo.findMccCategory(userId, categoryId)
                .orElseThrow(() -> notFound("MCC category not found"));
    }

    private CashbackRow requireCashback(int userId, long transactionId) {
        return repo.findCashbackTransaction(userId, transactionId)
                .orElseThrow(() -> notFound("Cashback transaction not found"));
    }

    private static LocalDate dayInMonth(YearMonth month, int requestedDay) {
        return month.atDay(Math.min(requestedDay, month.lengthOfMonth()));
    }

    private static LocalDate nextPaymentDate(LocalDate statementDate, int paymentDay) {
        YearMonth candidateMonth = YearMonth.from(statementDate);
        LocalDate candidate = dayInMonth(candidateMonth, paymentDay);
        if (!candidate.isAfter(statementDate)) {
            candidateMonth = candidateMonth.plusMonths(1);
            candidate = dayInMonth(candidateMonth, paymentDay);
        }
        return candidate;
    }

    private static void validateStatement(LocalDate statementDate, LocalDate dueDate,
                                          BigDecimal amount, LocalDateTime issuedAt) {
        if (!dueDate.isAfter(statementDate)) {
            throw badRequest("dueDate must be after statementDate");
        }
        if (issuedAt != null && amount == null) {
            throw badRequest("statementAmount is required when the statement is issued");
        }
    }

    private static void validateRuleDates(LocalDate from, LocalDate to) {
        if (to != null && to.isBefore(from)) {
            throw badRequest("effectiveTo cannot be before effectiveFrom");
        }
    }

    private static BigDecimal percentage(BigDecimal amount, BigDecimal rate) {
        return amount.multiply(rate).divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);
    }

    private static String normalizeCashbackStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!List.of("PENDING", "RECEIVED", "CANCELLED").contains(normalized)) {
            throw badRequest("Invalid cashback status");
        }
        return normalized;
    }

    private static String normalizeStatementStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!List.of("NOT_ISSUED", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE").contains(normalized)) {
            throw badRequest("Invalid statement status");
        }
        return normalized;
    }

    private static int safeSize(int size) {
        return Math.min(Math.max(size, 1), 100);
    }

    private static int totalPages(long total, int size) {
        return (int) Math.ceil((double) total / size);
    }

    private static String clean(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private record Calculation(BigDecimal discountAmount, BigDecimal cashbackRate,
                               BigDecimal monthlyCap, BigDecimal expectedCashback) {
    }
}

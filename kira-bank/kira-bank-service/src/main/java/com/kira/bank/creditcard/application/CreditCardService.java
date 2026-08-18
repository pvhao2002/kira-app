package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.*;
import com.kira.bank.creditcard.infrastructure.*;
import com.kira.bank.publiccatalog.infrastructure.BankRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

import static com.kira.bank.creditcard.application.CreditCardDtos.*;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
public class CreditCardService {
    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");
    private final UserCreditCardRepository cards;
    private final UserBankCreditLimitRepository creditLimits;
    private final BankRepository banks;
    private final StatementRepository statements;
    private final PaymentRepository payments;
    private final MonthlyStatementService monthlyStatements;
    private final BankBalanceService bankBalances;

    @Transactional
    public CardResponse createCard(Long user, CreateCardRequest r) {
        var bank = banks.findById(r.bankId())
            .filter(candidate -> candidate.isActive() && candidate.getDeletedAt() == null)
            .orElseThrow(() -> missing("BANK_NOT_FOUND"));
        UserCreditCard c = new UserCreditCard();
        c.setUserId(user);
        c.setBank(bank);
        UserBankCreditLimit creditLimit = creditLimits.findByUserIdAndBankIdAndDeletedAtIsNull(user, bank.getId())
            .map(existing -> requireMatchingCreditLimit(existing, r.creditLimit()))
            .orElseGet(() -> createCreditLimit(user, bank, r.creditLimit()));
        c.setCardType(r.cardType().trim());
        c.setNickname(r.nickname());
        c.setLastFour(r.lastFour());
        c.setStatementDay(r.statementDay());
        c.setDueDay(r.dueDay());
        c.setNote(r.note());
        c.setCreatedBy(user);
        c.setUpdatedBy(user);
        return cardDto(cards.save(c), creditLimit);
    }

    @Transactional(readOnly = true)
    public PageResponse<CardResponse> cards(Long user, String search, Pageable p) {
        Page<UserCreditCard> cardPage = cards.search(user, search == null ? "" : search.trim(), p);
        var cycles = monthlyStatements.currentCycles(user, cardPage.getContent());
        var balances = currentBalancesByBank(user, cardPage.getContent());
        var limits = creditLimitsByBank(user);
        Page<CardResponse> x = cardPage.map(card -> cardDto(card, cycles.get(card.getId()),
            balances.getOrDefault(card.getBank().getId(), BigDecimal.ZERO), requireCreditLimit(limits, card)));
        return page(x);
    }

    @Transactional(readOnly = true)
    public CardResponse card(Long user, Long id) {
        UserCreditCard card = ownCard(id, user);
        return cardDto(card, monthlyStatements.currentCycle(user, card), ownCreditLimit(user, card.getBank().getId()));
    }

    @Transactional
    public CardResponse updateCard(Long user, Long id, UpdateCardRequest r) {
        UserCreditCard c = ownCard(id, user);
        if (c.getVersion() != r.version())
            throw new ApiException(HttpStatus.CONFLICT, "CARD_VERSION_CONFLICT", "Dữ liệu thẻ đã được cập nhật ở phiên khác");
        if (!java.util.Set.of("ACTIVE", "INACTIVE", "CLOSED").contains(r.status()))
            throw invalid("INVALID_CARD_STATUS", "Trạng thái thẻ không hợp lệ");
        UserBankCreditLimit creditLimit = ownCreditLimit(user, c.getBank().getId());
        if (creditLimit.getVersion() != r.creditLimitVersion())
            throw conflict("CREDIT_LIMIT_VERSION_CONFLICT");
        creditLimit.setCreditLimit(money(r.creditLimit()));
        creditLimit.setUpdatedBy(user);
        c.setCardType(r.cardType().trim());
        c.setNickname(r.nickname());
        c.setLastFour(r.lastFour());
        c.setStatementDay(r.statementDay());
        c.setDueDay(r.dueDay());
        c.setNote(r.note());
        c.setStatus(r.status());
        c.setUpdatedBy(user);
        creditLimits.flush();
        return cardDto(c, monthlyStatements.currentCycle(user, c), creditLimit);
    }

    @Transactional(readOnly = true)
    public List<BankCreditLimitResponse> bankCreditLimits(Long user) {
        return creditLimits.findByUserIdAndDeletedAtIsNull(user).stream()
            .map(this::creditLimitDto)
            .sorted(Comparator.comparing(BankCreditLimitResponse::bankName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    @Transactional
    public BankCreditLimitResponse updateBankCreditLimit(Long user, Long bankId, BankCreditLimitUpdateRequest r) {
        UserBankCreditLimit creditLimit = ownCreditLimit(user, bankId);
        if (creditLimit.getVersion() != r.version())
            throw conflict("CREDIT_LIMIT_VERSION_CONFLICT");
        creditLimit.setCreditLimit(money(r.creditLimit()));
        creditLimit.setUpdatedBy(user);
        creditLimits.flush();
        return creditLimitDto(creditLimit);
    }

    @Transactional
    public BankBalanceResponse updateBankBalance(Long user, Long bankId, BankBalanceUpdateRequest request) {
        return bankBalances.updateBalance(user, bankId, request);
    }

    @Transactional
    public StatementResponse statement(Long user, StatementRequest r) {
        ownCard(r.userCardId(), user);
        if (r.periodEnd().isBefore(r.periodStart()) || r.dueDate().isBefore(r.statementDate()))
            throw invalid("INVALID_STATEMENT_DATES", "Ngày sao kê không hợp lệ");
        BigDecimal balance = money(r.openingBalance().add(r.totalSpending()).add(r.totalFee()).add(r.totalInterest()).subtract(r.totalRefund()));
        Statement s = new Statement();
        s.setUserId(user);
        s.setUserCardId(r.userCardId());
        s.setPeriodStart(r.periodStart());
        s.setPeriodEnd(r.periodEnd());
        s.setStatementDate(r.statementDate());
        s.setDueDate(r.dueDate());
        s.setOpeningBalance(money(r.openingBalance()));
        s.setTotalSpending(money(r.totalSpending()));
        s.setTotalRefund(money(r.totalRefund()));
        s.setTotalFee(money(r.totalFee()));
        s.setTotalInterest(money(r.totalInterest()));
        s.setMinimumPayment(money(r.minimumPayment()));
        s.setStatementBalance(balance);
        s.setRemainingAmount(balance);
        return statementDto(statements.save(s));
    }

    @Transactional(readOnly = true)
    public PageResponse<StatementResponse> statements(Long user, Pageable p) {
        Page<StatementResponse> x = statements.findByUserIdAndDeletedAtIsNull(user, p).map(this::statementDto);
        return page(x);
    }

    @Transactional
    public PaymentResponse pay(Long user, Long statementId, String key, PaymentRequest r) {
        requireKey(key);
        var old = payments.findByUserIdAndIdempotencyKey(user, key);
        if (old.isPresent()) {
            Payment p = old.get();
            return new PaymentResponse(p.getId(), p.getStatus(), statementDto(statement(statementId, user)));
        }
        Statement s = statement(statementId, user);
        if ("PAID".equals(s.getStatus()) || "CANCELLED".equals(s.getStatus()))
            throw invalid("STATEMENT_NOT_PAYABLE", "Sao kê không thể thanh toán");
        BigDecimal amount = money(r.amount());
        if (amount.subtract(s.getRemainingAmount()).compareTo(TOLERANCE) > 0)
            throw invalid("PAYMENT_EXCEEDS_REMAINING", "Số tiền thanh toán vượt dư nợ còn lại");
        Payment p = new Payment();
        p.setUserId(user);
        p.setStatementId(s.getId());
        p.setPaymentDate(Instant.now());
        p.setAmount(amount);
        p.setPaymentMethod(r.paymentMethod());
        p.setSourceAccount(r.sourceAccount());
        p.setReferenceNumber(r.referenceNumber());
        p.setNote(r.note());
        p.setIdempotencyKey(key);
        payments.save(p);
        s.setPaidAmount(money(s.getPaidAmount().add(amount)));
        BigDecimal remaining = money(s.getStatementBalance().subtract(s.getPaidAmount()).max(BigDecimal.ZERO));
        s.setRemainingAmount(remaining);
        s.setStatus(remaining.compareTo(TOLERANCE) <= 0 ? "PAID" : "PARTIALLY_PAID");
        return new PaymentResponse(p.getId(), p.getStatus(), statementDto(s));
    }

    @Transactional(readOnly = true)
    public PageResponse<Payment> payments(Long user, Pageable p) {
        return page(payments.findByUserIdAndDeletedAtIsNull(user, p));
    }

    private UserCreditCard ownCard(Long id, Long user) {
        return cards.findByIdAndUserIdAndDeletedAtIsNull(id, user).orElseThrow(() -> missing("USER_CARD_NOT_FOUND"));
    }

    private Statement statement(Long id, Long user) {
        return statements.findByIdAndUserIdAndDeletedAtIsNull(id, user).orElseThrow(() -> missing("STATEMENT_NOT_FOUND"));
    }

    private CardResponse cardDto(UserCreditCard c, UserBankCreditLimit creditLimit) {
        return cardDto(c, monthlyStatements.currentCycle(c.getUserId(), c),
            currentBalanceForBank(c.getUserId(), c.getBank().getId()), creditLimit);
    }

    private CardResponse cardDto(UserCreditCard c, BillingCycleResponse billing, UserBankCreditLimit creditLimit) {
        return cardDto(c, billing, currentBalanceForBank(c.getUserId(), c.getBank().getId()), creditLimit);
    }

    private CardResponse cardDto(UserCreditCard c, BillingCycleResponse billing, BigDecimal currentBalance,
                                 UserBankCreditLimit creditLimit) {
        String bankName = c.getBank().getShortName() == null || c.getBank().getShortName().isBlank()
            ? c.getBank().getName() : c.getBank().getShortName();
        return new CardResponse(c.getId(), c.getBank().getId(), bankName, c.getBank().getLogoUrl(), c.getCardType(),
            c.getNickname(),
            c.getLastFour(), creditLimit.getCreditLimit(), creditLimit.getVersion(), money(currentBalance),
            creditLimit.getBalanceVersion(),
            creditLimit.getCurrency(), c.getStatementDay(),
            c.getDueDay(), c.getStatus(), c.getNote(), c.getVersion(),
            billing.billingCycleId(), billing.statementDate(), billing.paymentDueDate(),
            billing.statementBalance(), billing.minimumPayment(), billing.billingStatus(), billing.billingVersion());
    }

    private UserBankCreditLimit createCreditLimit(Long user, com.kira.bank.publiccatalog.domain.Bank bank,
                                                  BigDecimal amount) {
        UserBankCreditLimit creditLimit = new UserBankCreditLimit();
        creditLimit.setUserId(user);
        creditLimit.setBank(bank);
        creditLimit.setCreditLimit(money(amount));
        creditLimit.setCurrency("VND");
        creditLimit.setCreatedBy(user);
        creditLimit.setUpdatedBy(user);
        return creditLimits.save(creditLimit);
    }

    private UserBankCreditLimit requireMatchingCreditLimit(UserBankCreditLimit creditLimit, BigDecimal requested) {
        if (creditLimit.getCreditLimit().compareTo(money(requested)) != 0)
            throw invalid("SHARED_CREDIT_LIMIT_MISMATCH",
                "Hạn mức phải khớp với hạn mức chung hiện tại của ngân hàng");
        return creditLimit;
    }

    private UserBankCreditLimit ownCreditLimit(Long user, Long bankId) {
        return creditLimits.findByUserIdAndBankIdAndDeletedAtIsNull(user, bankId)
            .orElseThrow(() -> missing("BANK_CREDIT_LIMIT_NOT_FOUND"));
    }

    private Map<Long, UserBankCreditLimit> creditLimitsByBank(Long user) {
        Map<Long, UserBankCreditLimit> result = new HashMap<>();
        creditLimits.findByUserIdAndDeletedAtIsNull(user)
            .forEach(limit -> result.put(limit.getBank().getId(), limit));
        return result;
    }

    private UserBankCreditLimit requireCreditLimit(Map<Long, UserBankCreditLimit> limits, UserCreditCard card) {
        UserBankCreditLimit creditLimit = limits.get(card.getBank().getId());
        if (creditLimit == null)
            throw missing("BANK_CREDIT_LIMIT_NOT_FOUND");
        return creditLimit;
    }

    private BankCreditLimitResponse creditLimitDto(UserBankCreditLimit creditLimit) {
        String bankName = creditLimit.getBank().getShortName() == null || creditLimit.getBank().getShortName().isBlank()
            ? creditLimit.getBank().getName() : creditLimit.getBank().getShortName();
        return new BankCreditLimitResponse(creditLimit.getBank().getId(), bankName,
            creditLimit.getBank().getLogoUrl(), creditLimit.getCreditLimit(), creditLimit.getCurrency(),
            creditLimit.getVersion());
    }

    private Map<Long, BigDecimal> currentBalancesByBank(Long userId, Collection<UserCreditCard> userCards) {
        if (userCards.isEmpty()) {
            return Collections.emptyMap();
        }
        var bankIds = userCards.stream().map(card -> card.getBank().getId()).distinct().toList();
        return bankBalances.currentBalances(userId, bankIds);
    }

    private BigDecimal currentBalanceForBank(Long userId, Long bankId) {
        return bankBalances.currentBalance(userId, bankId);
    }

    private StatementResponse statementDto(Statement s) {
        return new StatementResponse(s.getId(), s.getStatementBalance(), s.getPaidAmount(), s.getRemainingAmount(), s.getStatus(), s.getVersion());
    }

    private <T> PageResponse<T> page(Page<T> p) {
        return new PageResponse<>(p.getContent(), new PageMeta(p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages()));
    }

    private BigDecimal money(BigDecimal n) {
        return n.setScale(4, RoundingMode.HALF_UP);
    }

    private void requireKey(String k) {
        if (k == null || k.isBlank() || k.length() > 100)
            throw invalid("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key là bắt buộc");
    }

    private ApiException invalid(String c, String m) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, c, m);
    }

    private ApiException missing(String c) {
        return new ApiException(HttpStatus.NOT_FOUND, c, "Không tìm thấy dữ liệu");
    }

    private ApiException conflict(String code) {
        return new ApiException(HttpStatus.CONFLICT, code,
            "Hạn mức ngân hàng đã được cập nhật ở phiên khác");
    }
}

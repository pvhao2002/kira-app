package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.Payment;
import com.kira.bank.creditcard.domain.Statement;
import com.kira.bank.creditcard.domain.UserCreditCard;
import com.kira.bank.creditcard.infrastructure.PaymentRepository;
import com.kira.bank.creditcard.infrastructure.StatementRepository;
import com.kira.bank.creditcard.infrastructure.UserCreditCardRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

import static com.kira.bank.creditcard.application.CreditCardDtos.BillingCycleResponse;
import static com.kira.bank.creditcard.application.CreditCardDtos.BillingCycleUpdateRequest;

@Service
@RequiredArgsConstructor
public class MonthlyStatementService {
    private static final String NEEDS_INPUT = "NEEDS_INPUT";
    private static final String PAID = "PAID";
    private static final String OPEN = "OPEN";

    private final UserCreditCardRepository cards;
    private final StatementRepository statements;
    private final PaymentRepository payments;

    @Value("${CARD_STATEMENT_JOB_TIME_ZONE:Asia/Bangkok}")
    private String timeZone;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureCurrentCycle(Long cardId, LocalDate today) {
        UserCreditCard card = cards.findById(cardId).orElse(null);
        if (card == null || card.getDeletedAt() != null || !"ACTIVE".equals(card.getStatus())) {
            return;
        }
        ensureCycle(card, today);
    }

    @Transactional(readOnly = true)
    public Map<Long, BillingCycleResponse> currentCycles(Long userId, Collection<UserCreditCard> userCards) {
        if (userCards.isEmpty()) {
            return Collections.emptyMap();
        }
        LocalDate today = today();
        YearMonth month = YearMonth.from(today);
        var ids = userCards.stream().map(UserCreditCard::getId).toList();
        Map<Long, Statement> outstandingByCard = new HashMap<>();
        statements.findOutstandingForCards(userId, ids)
            .forEach(statement -> outstandingByCard.putIfAbsent(statement.getUserCardId(), statement));
        Map<Long, Statement> currentByCard = statements
            .findByUserIdAndUserCardIdInAndStatementDateBetweenAndDeletedAtIsNull(
                userId, ids, month.atDay(1), month.atEndOfMonth())
            .stream()
            .collect(Collectors.toMap(Statement::getUserCardId, statement -> statement, this::latest));
        return userCards.stream().collect(Collectors.toMap(UserCreditCard::getId,
            card -> response(card, outstandingByCard.getOrDefault(
                card.getId(), currentByCard.get(card.getId())), today)));
    }

    @Transactional(readOnly = true)
    public BillingCycleResponse currentCycle(Long userId, UserCreditCard card) {
        if (!card.getUserId().equals(userId)) {
            throw missing("USER_CARD_NOT_FOUND");
        }
        LocalDate today = today();
        Statement statement = selectedStatement(userId, card, today);
        return response(card, statement, today);
    }

    @Transactional
    public BillingCycleResponse updateCurrentCycle(Long userId, Long cardId, BillingCycleUpdateRequest request) {
        UserCreditCard card = cards.findByIdAndUserIdAndDeletedAtIsNull(cardId, userId)
            .orElseThrow(() -> missing("USER_CARD_NOT_FOUND"));
        LocalDate today = today();
        Statement statement;
        if (request.billingCycleId() != null) {
            statement = statements.findByIdAndUserIdAndUserCardIdAndDeletedAtIsNull(
                    request.billingCycleId(), userId, cardId)
                .orElseThrow(() -> missing("STATEMENT_NOT_FOUND"));
        } else {
            if (!statements.findOutstandingForCards(userId, List.of(cardId)).isEmpty()) {
                throw new ApiException(HttpStatus.CONFLICT, "BILLING_CYCLE_ID_REQUIRED",
                    "Billing cycle changed; reload the page and try again");
            }
            statement = ensureCycle(card, today);
        }
        if (statement == null) {
            throw invalid("STATEMENT_NOT_DUE", "Chưa đến ngày sao kê của thẻ");
        }
        if (statement.getVersion() != request.version()) {
            throw new ApiException(HttpStatus.CONFLICT, "STATEMENT_VERSION_CONFLICT",
                "Dữ liệu sao kê đã được cập nhật ở phiên khác");
        }
        if (PAID.equals(statement.getStatus())) {
            throw invalid("STATEMENT_ALREADY_PAID", "Sao kê đã được thanh toán");
        }
        if (!isOutstanding(statement)) {
            throw invalid("STATEMENT_NOT_ACTIONABLE", "Statement no longer requires payment");
        }
        if (payments.existsByStatementIdAndDeletedAtIsNull(statement.getId())) {
            throw invalid("STATEMENT_HAS_PAYMENT", "Không thể sửa số tiền của sao kê đã có thanh toán");
        }
        BigDecimal balance = money(request.statementBalance());
        BigDecimal minimum = balance.signum() == 0 ? zero() : money(request.minimumPayment());
        if (balance.signum() > 0 && minimum.signum() == 0) {
            throw invalid("MINIMUM_PAYMENT_REQUIRED", "Thanh toán tối thiểu phải lớn hơn 0 khi sao kê có dư nợ");
        }
        if (minimum.compareTo(balance) > 0) {
            throw invalid("MINIMUM_PAYMENT_EXCEEDS_BALANCE", "Thanh toán tối thiểu không được vượt tổng dư nợ");
        }
        if (!"UNPAID".equals(request.paymentStatus()) && !PAID.equals(request.paymentStatus())) {
            throw invalid("INVALID_PAYMENT_STATUS", "Trạng thái thanh toán không hợp lệ");
        }

        statement.setStatementBalance(balance);
        statement.setMinimumPayment(minimum);
        statement.setUpdatedBy(userId);
        if (balance.signum() == 0) {
            statement.setPaidAmount(zero());
            statement.setRemainingAmount(zero());
            statement.setStatus(PAID);
        } else if (PAID.equals(request.paymentStatus())) {
            createFullPayment(userId, statement, balance);
            statement.setPaidAmount(balance);
            statement.setRemainingAmount(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
            statement.setStatus(PAID);
        } else {
            statement.setPaidAmount(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
            statement.setRemainingAmount(balance);
            statement.setStatus(OPEN);
        }
        statements.saveAndFlush(statement);
        return response(card, statement, today);
    }

    private Statement ensureCycle(UserCreditCard card, LocalDate today) {
        YearMonth month = YearMonth.from(today);
        Statement existing = currentStatement(card.getId(), month);
        if (existing != null) {
            return existing;
        }
        if (!"ACTIVE".equals(card.getStatus())) {
            return null;
        }
        LocalDate statementDate = dayOfMonth(month, card.getStatementDay());
        if (today.isBefore(statementDate)) {
            return null;
        }
        Statement statement = new Statement();
        statement.setUserId(card.getUserId());
        statement.setUserCardId(card.getId());
        statement.setPeriodStart(dayOfMonth(month.minusMonths(1), card.getStatementDay()).plusDays(1));
        statement.setPeriodEnd(statementDate);
        statement.setStatementDate(statementDate);
        statement.setDueDate(dueDate(card, statementDate));
        statement.setStatementBalance(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
        statement.setMinimumPayment(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
        statement.setPaidAmount(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
        statement.setRemainingAmount(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
        statement.setStatus(NEEDS_INPUT);
        return statements.saveAndFlush(statement);
    }

    private Statement currentStatement(Long cardId, YearMonth month) {
        return statements.findFirstByUserCardIdAndStatementDateBetweenAndDeletedAtIsNullOrderByStatementDateDesc(
            cardId, month.atDay(1), month.atEndOfMonth()).orElse(null);
    }

    private Statement selectedStatement(Long userId, UserCreditCard card, LocalDate today) {
        List<Statement> outstanding = statements.findOutstandingForCards(userId, List.of(card.getId()));
        return outstanding.isEmpty()
            ? currentStatement(card.getId(), YearMonth.from(today))
            : outstanding.getFirst();
    }

    private Statement latest(Statement first, Statement second) {
        int dateOrder = first.getStatementDate().compareTo(second.getStatementDate());
        if (dateOrder != 0) {
            return dateOrder > 0 ? first : second;
        }
        return first.getId() > second.getId() ? first : second;
    }

    private boolean isOutstanding(Statement statement) {
        if (NEEDS_INPUT.equals(statement.getStatus())) {
            return true;
        }
        return List.of(OPEN, "UNPAID", "PARTIALLY_PAID").contains(statement.getStatus())
            && statement.getRemainingAmount().signum() > 0;
    }

    private BillingCycleResponse response(UserCreditCard card, Statement statement, LocalDate today) {
        LocalDate expectedStatementDate = dayOfMonth(YearMonth.from(today), card.getStatementDay());
        LocalDate paymentDueDate = statement == null ? dueDate(card, expectedStatementDate) : statement.getDueDate();
        String status;
        if (statement == null) {
            status = !"ACTIVE".equals(card.getStatus()) || today.isBefore(expectedStatementDate)
                ? "NOT_DUE" : NEEDS_INPUT;
        } else if (PAID.equals(statement.getStatus())) {
            status = PAID;
        } else if (NEEDS_INPUT.equals(statement.getStatus())) {
            status = NEEDS_INPUT;
        } else {
            status = today.isAfter(statement.getDueDate()) ? "OVERDUE" : "UNPAID";
        }
        boolean hasAmount = statement != null && !NEEDS_INPUT.equals(statement.getStatus());
        return new BillingCycleResponse(statement == null ? null : statement.getId(),
            statement == null ? expectedStatementDate : statement.getStatementDate(), paymentDueDate,
            hasAmount ? statement.getStatementBalance() : null,
            hasAmount ? statement.getMinimumPayment() : null,
            status, statement == null ? 0 : statement.getVersion());
    }

    private void createFullPayment(Long userId, Statement statement, BigDecimal amount) {
        String reference = "MONTHLY-STATEMENT-" + statement.getId() + "-FULL";
        if (payments.findByUserIdAndIdempotencyKey(userId, reference).isPresent()) {
            return;
        }
        Payment payment = new Payment();
        payment.setUserId(userId);
        payment.setStatementId(statement.getId());
        payment.setPaymentDate(Instant.now());
        payment.setAmount(amount);
        payment.setPaymentMethod("MANUAL_CONFIRMATION");
        payment.setReferenceNumber(reference);
        payment.setIdempotencyKey(reference);
        payment.setCreatedBy(userId);
        payment.setUpdatedBy(userId);
        payments.save(payment);
    }

    private LocalDate dueDate(UserCreditCard card, LocalDate statementDate) {
        YearMonth statementMonth = YearMonth.from(statementDate);
        LocalDate sameMonth = dayOfMonth(statementMonth, card.getDueDay());
        return sameMonth.isAfter(statementDate)
            ? sameMonth : dayOfMonth(statementMonth.plusMonths(1), card.getDueDay());
    }

    private LocalDate dayOfMonth(YearMonth month, int day) {
        return month.atDay(Math.min(day, month.lengthOfMonth()));
    }

    private LocalDate today() {
        return LocalDate.now(ZoneId.of(timeZone));
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
    }

    private ApiException invalid(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }

    private ApiException missing(String code) {
        return new ApiException(HttpStatus.NOT_FOUND, code, "Không tìm thấy dữ liệu");
    }
}

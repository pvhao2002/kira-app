package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.*;
import com.kira.bank.creditcard.infrastructure.*;
import com.kira.bank.publiccatalog.infrastructure.*;
import com.kira.bank.shared.web.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.*;
import java.time.*;

import static com.kira.bank.creditcard.application.CreditCardDtos.*;
import static com.kira.bank.shared.web.ApiTypes.*;

@Service
@RequiredArgsConstructor
public class CreditCardService {
    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");
    private final UserCreditCardRepository cards;
    private final BankRepository banks;
    private final CardTransactionRepository transactions;
    private final StatementRepository statements;
    private final PaymentRepository payments;
    private final DiscountInvoiceRepository invoices;
    private final CashbackRecordRepository cashbacks;
    private final MonthlyStatementService monthlyStatements;

    @Transactional
    public CardResponse createCard(Long user, CreateCardRequest r) {
        var bank = banks.findById(r.bankId())
                .filter(candidate -> candidate.isActive() && candidate.getDeletedAt() == null)
                .orElseThrow(() -> missing("BANK_NOT_FOUND"));
        UserCreditCard c = new UserCreditCard();
        c.setUserId(user);
        c.setBank(bank);
        c.setNickname(r.nickname());
        c.setLastFour(r.lastFour());
        c.setCreditLimit(money(r.creditLimit()));
        c.setStatementDay(r.statementDay());
        c.setDueDay(r.dueDay());
        c.setNote(r.note());
        c.setCreatedBy(user);
        c.setUpdatedBy(user);
        return cardDto(cards.save(c));
    }

    @Transactional(readOnly = true)
    public PageResponse<CardResponse> cards(Long user, Pageable p) {
        Page<UserCreditCard> cardPage = cards.findByUserIdAndDeletedAtIsNull(user, p);
        var cycles = monthlyStatements.currentCycles(user, cardPage.getContent());
        Page<CardResponse> x = cardPage.map(card -> cardDto(card, cycles.get(card.getId())));
        return page(x);
    }

    @Transactional(readOnly = true)
    public CardResponse card(Long user, Long id) {
        UserCreditCard card = ownCard(id, user);
        return cardDto(card, monthlyStatements.currentCycle(user, card));
    }

    @Transactional
    public CardResponse updateCard(Long user, Long id, UpdateCardRequest r) {
        UserCreditCard c = ownCard(id, user);
        if (c.getVersion() != r.version())
            throw new ApiException(HttpStatus.CONFLICT, "CARD_VERSION_CONFLICT", "Dữ liệu thẻ đã được cập nhật ở phiên khác");
        if (!java.util.Set.of("ACTIVE", "INACTIVE", "CLOSED").contains(r.status()))
            throw invalid("INVALID_CARD_STATUS", "Trạng thái thẻ không hợp lệ");
        c.setNickname(r.nickname());
        c.setLastFour(r.lastFour());
        c.setCreditLimit(money(r.creditLimit()));
        c.setStatementDay(r.statementDay());
        c.setDueDay(r.dueDay());
        c.setNote(r.note());
        c.setStatus(r.status());
        c.setUpdatedBy(user);
        return cardDto(c, monthlyStatements.currentCycle(user, c));
    }

    @Transactional
    public CardTransaction transaction(Long user, TransactionRequest r) {
        ownCard(r.userCardId(), user);
        if (transactions.existsByUserIdAndUserCardIdAndReferenceNumber(user, r.userCardId(), r.referenceNumber()))
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_TRANSACTION", "Giao dịch có thể bị trùng");
        CardTransaction t = new CardTransaction();
        t.setUserId(user);
        t.setUserCardId(r.userCardId());
        t.setTransactionDate(r.transactionDate());
        t.setMccId(r.mccId());
        t.setAmount(money(r.amount()));
        t.setCurrency(r.currency() == null ? "VND" : r.currency());
        t.setReferenceNumber(r.referenceNumber());
        t.setDescription(r.description());
        t.setNote(r.note());
        return transactions.save(t);
    }

    @Transactional(readOnly = true)
    public PageResponse<CardTransaction> transactions(Long user, Pageable p) {
        return page(transactions.findByUserIdAndDeletedAtIsNull(user, p));
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

    @Transactional(readOnly = true)
    public PageResponse<CashbackRecord> cashbacks(Long user, Pageable p) {
        return page(cashbacks.findByUserIdAndDeletedAtIsNull(user, p));
    }

    @Transactional
    public InvoiceResponse invoice(Long user, InvoiceRequest r) {
        ownCard(r.userCardId(), user);
        BigDecimal discount = money(r.invoiceAmount().multiply(r.serviceDiscountRate()));
        BigDecimal cost = money(discount.add(r.additionalFee()));
        BigDecimal expected = money(r.invoiceAmount().multiply(r.cashbackRate()));
        BigDecimal actual = money(r.actualCashback() == null ? BigDecimal.ZERO : r.actualCashback());
        DiscountInvoice i = new DiscountInvoice();
        i.setUserId(user);
        i.setUserCardId(r.userCardId());
        i.setServiceProviderId(r.serviceProviderId());
        i.setInvoiceNumber(r.invoiceNumber());
        i.setInvoiceDate(r.invoiceDate());
        i.setInvoiceAmount(money(r.invoiceAmount()));
        i.setAmountPaid(money(r.amountPaid()));
        i.setServiceDiscountRate(r.serviceDiscountRate());
        i.setServiceDiscountAmount(discount);
        i.setAdditionalFee(money(r.additionalFee()));
        i.setCashbackRate(r.cashbackRate());
        i.setExpectedCashback(expected);
        i.setActualCashback(actual);
        i.setExpectedProfit(money(expected.subtract(cost)));
        i.setActualProfit(money(actual.subtract(cost)));
        i.setCapitalLocked(money(r.amountPaid()));
        i.setStatus(actual.signum() > 0 ? "CASHBACK_RECEIVED" : "PAID");
        i.setNote(r.note());
        invoices.save(i);
        return invoiceDto(i);
    }

    @Transactional(readOnly = true)
    public PageResponse<InvoiceResponse> invoices(Long user, Pageable p) {
        Page<InvoiceResponse> x = invoices.findByUserIdAndDeletedAtIsNull(user, p).map(this::invoiceDto);
        return page(x);
    }

    private UserCreditCard ownCard(Long id, Long user) {
        return cards.findByIdAndUserIdAndDeletedAtIsNull(id, user).orElseThrow(() -> missing("USER_CARD_NOT_FOUND"));
    }

    private Statement statement(Long id, Long user) {
        return statements.findByIdAndUserIdAndDeletedAtIsNull(id, user).orElseThrow(() -> missing("STATEMENT_NOT_FOUND"));
    }

    private CardResponse cardDto(UserCreditCard c) {
        return cardDto(c, monthlyStatements.currentCycle(c.getUserId(), c));
    }

    private CardResponse cardDto(UserCreditCard c, BillingCycleResponse billing) {
        String bankName = c.getBank().getShortName() == null || c.getBank().getShortName().isBlank()
                ? c.getBank().getName() : c.getBank().getShortName();
        return new CardResponse(c.getId(), c.getBank().getId(), bankName, c.getBank().getLogoUrl(), c.getNickname(),
                c.getLastFour(), c.getCreditLimit(), c.getCurrency(), c.getStatementDay(),
                c.getDueDay(), c.getStatus(), c.getNote(), c.getVersion(),
                billing.billingCycleId(), billing.statementDate(), billing.paymentDueDate(),
                billing.statementBalance(), billing.minimumPayment(), billing.billingStatus(), billing.billingVersion());
    }

    private StatementResponse statementDto(Statement s) {
        return new StatementResponse(s.getId(), s.getStatementBalance(), s.getPaidAmount(), s.getRemainingAmount(), s.getStatus(), s.getVersion());
    }

    private InvoiceResponse invoiceDto(DiscountInvoice i) {
        return new InvoiceResponse(i.getId(), money(i.getServiceDiscountAmount().add(i.getAdditionalFee())), i.getExpectedCashback(), i.getActualCashback(), i.getExpectedProfit(), i.getActualProfit(), i.getStatus());
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
}

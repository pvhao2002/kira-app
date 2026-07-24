package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.*;
import com.kira.bank.investment.infrastructure.*;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.*;
import java.time.Instant;

import static com.kira.bank.investment.application.InvestmentDtos.*;
import static com.kira.bank.shared.web.ApiTypes.*;

@Service
@RequiredArgsConstructor
public class InvestmentService {
    private static final BigDecimal TOLERANCE = new BigDecimal("0.01");
    private final InvestmentAccountRepository accounts;
    private final InvestmentDepositRepository deposits;
    private final InvestmentTaskRepository tasks;
    private final TaskSettlementRepository settlements;
    private final InvestmentWithdrawalRepository withdrawals;
    private final LedgerRepository ledger;
    private final InvestmentPlatformRepository platforms;
    private final InvestmentRewardRepository rewards;

    @Transactional
    public AccountResponse createAccount(Long userId, CreateAccountRequest r) {
        InvestmentAccount a = new InvestmentAccount();
        a.setUserId(userId);
        a.setPlatformId(r.platformId());
        a.setAccountName(r.accountName());
        a.setExternalAccountCode(r.externalAccountCode());
        a.setCurrency(r.currency() == null ? "VND" : r.currency());
        a.setNote(r.note());
        return dto(accounts.save(a));
    }

    @Transactional(readOnly = true)
    public PageResponse<AccountResponse> accounts(Long userId, Pageable pageable) {
        Page<AccountResponse> p = accounts.findByUserIdAndDeletedAtIsNull(userId, pageable).map(this::dto);
        return new PageResponse<>(p.getContent(), new PageMeta(p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public AccountResponse accountDetails(Long userId, Long id) {
        return dto(account(id, userId));
    }

    @Transactional
    public AccountResponse updateAccount(Long userId, Long id, UpdateAccountRequest r) {
        InvestmentAccount a = account(id, userId);
        if (a.getVersion() != r.version())
            throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_VERSION_CONFLICT", "Dữ liệu tài khoản đã được cập nhật ở phiên khác");
        if (!java.util.Set.of("ACTIVE", "INACTIVE", "CLOSED").contains(r.status()))
            throw bad("INVALID_ACCOUNT_STATUS", "Trạng thái tài khoản không hợp lệ");
        a.setAccountName(r.accountName());
        a.setExternalAccountCode(r.externalAccountCode());
        a.setNote(r.note());
        a.setStatus(r.status());
        return dto(a);
    }

    @Transactional(readOnly = true)
    public PageResponse<InvestmentPlatform> platforms(Pageable p) {
        return page(platforms.findByActiveTrueAndDeletedAtIsNull(p));
    }

    @Transactional(readOnly = true)
    public PageResponse<InvestmentDeposit> deposits(Long user, Pageable p) {
        return page(deposits.findByUserIdAndDeletedAtIsNull(user, p));
    }

    @Transactional(readOnly = true)
    public PageResponse<InvestmentTask> tasks(Long user, Pageable p) {
        return page(tasks.findByUserIdAndDeletedAtIsNull(user, p));
    }

    @Transactional(readOnly = true)
    public PageResponse<InvestmentWithdrawal> withdrawals(Long user, Pageable p) {
        return page(withdrawals.findByUserIdAndDeletedAtIsNull(user, p));
    }

    @Transactional(readOnly = true)
    public PageResponse<InvestmentReward> rewards(Long user, Pageable p) {
        return page(rewards.findByUserIdAndDeletedAtIsNull(user, p));
    }

    @Transactional
    public OperationResponse reward(Long user, String key, RewardRequest r) {
        requireKey(key);
        var old = rewards.findByUserIdAndIdempotencyKey(user, key);
        if (old.isPresent()) {
            var reward = old.get();
            return new OperationResponse(reward.getId(), reward.getStatus(), dto(account(reward.getInvestmentAccountId(), user)));
        }
        InvestmentAccount a = account(r.accountId(), user);
        if (r.taskId() != null) task(r.taskId(), user);
        InvestmentReward reward = new InvestmentReward();
        reward.setUserId(user);
        reward.setInvestmentAccountId(a.getId());
        reward.setInvestmentTaskId(r.taskId());
        reward.setRewardType(r.rewardType());
        reward.setRewardSource(r.rewardSource());
        reward.setRewardDate(Instant.now());
        reward.setAmount(money(r.amount()));
        reward.setStatus("RECEIVED");
        reward.setConditionDescription(r.conditionDescription());
        reward.setNote(r.note());
        reward.setIdempotencyKey(key);
        rewards.save(reward);
        a.setAvailableCapital(money(a.getAvailableCapital().add(r.amount())));
        a.setAccumulatedReward(money(a.getAccumulatedReward().add(r.amount())));
        change(a, "REWARD", money(r.amount()), "REWARD", reward.getId(), key, "Reward nhận riêng");
        return new OperationResponse(reward.getId(), reward.getStatus(), dto(a));
    }

    @Transactional
    public OperationResponse completeDeposit(Long userId, String key, DepositRequest r) {
        requireKey(key);
        var prior = deposits.findByUserIdAndIdempotencyKey(userId, key);
        if (prior.isPresent()) {
            InvestmentDeposit d = prior.get();
            return new OperationResponse(d.getId(), d.getStatus(), dto(account(d.getInvestmentAccountId(), userId)));
        }
        InvestmentAccount a = account(r.accountId(), userId);
        BigDecimal net = money(r.amount().subtract(r.fee()));
        if (net.signum() <= 0) throw bad("INVALID_NET_AMOUNT", "Số tiền thực nhận phải lớn hơn 0");
        InvestmentDeposit d = new InvestmentDeposit();
        d.setUserId(userId);
        d.setInvestmentAccountId(a.getId());
        d.setDepositDate(Instant.now());
        d.setAmount(money(r.amount()));
        d.setFee(money(r.fee()));
        d.setNetReceivedAmount(net);
        d.setPaymentMethod(r.paymentMethod());
        d.setReferenceNumber(r.referenceNumber());
        d.setStatus("COMPLETED");
        d.setNote(r.note());
        d.setIdempotencyKey(key);
        deposits.save(d);
        change(a, "DEPOSIT", net, "DEPOSIT", d.getId(), key, "Nạp tiền hoàn tất");
        a.setAvailableCapital(money(a.getAvailableCapital().add(net)));
        if (r.fee().signum() > 0)
            append(a, "DEPOSIT_FEE", money(r.fee().negate()), "DEPOSIT", d.getId(), key + ":fee", "Phí nạp tiền");
        return new OperationResponse(d.getId(), d.getStatus(), dto(a));
    }

    @Transactional
    public OperationResponse allocate(Long userId, String key, TaskRequest r) {
        requireKey(key);
        var prior = tasks.findByUserIdAndIdempotencyKey(userId, key);
        if (prior.isPresent()) {
            var t = prior.get();
            return new OperationResponse(t.getId(), t.getStatus(), dto(account(t.getInvestmentAccountId(), userId)));
        }
        InvestmentAccount a = account(r.accountId(), userId);
        BigDecimal capital = money(r.allocatedCapital());
        if (a.getAvailableCapital().compareTo(capital) < 0)
            throw bad("INSUFFICIENT_AVAILABLE_CAPITAL", "Capital khả dụng không đủ");
        InvestmentTask t = new InvestmentTask();
        t.setUserId(userId);
        t.setInvestmentAccountId(a.getId());
        t.setTaskCode(r.taskCode());
        t.setTaskName(r.taskName());
        t.setTaskType(r.taskType());
        t.setStartDate(Instant.now());
        t.setExpectedCompletionDate(r.expectedCompletionDate());
        t.setAllocatedCapital(capital);
        t.setExpectedCapitalReturn(capital);
        t.setExpectedProfit(zero(r.expectedProfit()));
        t.setExpectedReward(zero(r.expectedReward()));
        t.setStatus("IN_PROGRESS");
        t.setIdempotencyKey(key);
        tasks.save(t);
        a.setAvailableCapital(money(a.getAvailableCapital().subtract(capital)));
        a.setLockedCapital(money(a.getLockedCapital().add(capital)));
        append(a, "CAPITAL_ALLOCATION", capital.negate(), "TASK", t.getId(), key, "Phân bổ capital vào nhiệm vụ");
        return new OperationResponse(t.getId(), t.getStatus(), dto(a));
    }

    @Transactional
    public OperationResponse settle(Long userId, Long taskId, String key, SettlementRequest r) {
        requireKey(key);
        var prior = settlements.findByUserIdAndIdempotencyKey(userId, key);
        if (prior.isPresent()) {
            var s = prior.get();
            var t = task(taskId, userId);
            return new OperationResponse(s.getId(), s.getStatus(), dto(account(t.getInvestmentAccountId(), userId)));
        }
        InvestmentTask t = task(taskId, userId);
        if (!"IN_PROGRESS".equals(t.getStatus()) && !"WAITING_SETTLEMENT".equals(t.getStatus()))
            throw bad("TASK_NOT_SETTLEABLE", "Trạng thái nhiệm vụ không cho phép settlement");
        BigDecimal calculated = money(r.capitalReturned().add(r.profitReceived()).add(r.rewardReceived()).subtract(r.fee()));
        if (calculated.subtract(r.totalReceived()).abs().compareTo(TOLERANCE) > 0)
            throw bad("INVALID_SETTLEMENT_TOTAL", "Tổng nhận không khớp capital + profit + reward - fee");
        if (r.capitalReturned().compareTo(t.getAllocatedCapital()) > 0)
            throw bad("CAPITAL_RETURN_EXCEEDS_ALLOCATION", "Capital hoàn lại vượt quá capital đã phân bổ");
        InvestmentAccount a = account(t.getInvestmentAccountId(), userId);
        TaskSettlement s = new TaskSettlement();
        s.setUserId(userId);
        s.setInvestmentTaskId(t.getId());
        s.setSettlementDate(Instant.now());
        s.setTotalReceived(money(r.totalReceived()));
        s.setCapitalReturned(money(r.capitalReturned()));
        s.setProfitReceived(money(r.profitReceived()));
        s.setRewardReceived(money(r.rewardReceived()));
        s.setFee(money(r.fee()));
        s.setNetReceived(calculated);
        s.setReferenceNumber(r.referenceNumber());
        s.setStatus("COMPLETED");
        s.setIdempotencyKey(key);
        settlements.save(s);
        a.setLockedCapital(money(a.getLockedCapital().subtract(t.getAllocatedCapital())));
        a.setAvailableCapital(money(a.getAvailableCapital().add(r.capitalReturned()).add(r.profitReceived()).add(r.rewardReceived()).subtract(r.fee())));
        a.setAccumulatedProfit(money(a.getAccumulatedProfit().add(r.profitReceived())));
        a.setAccumulatedReward(money(a.getAccumulatedReward().add(r.rewardReceived())));
        a.setCurrentBalance(money(a.getCurrentBalance().add(calculated)));
        append(a, "CAPITAL_RETURN", r.capitalReturned(), "SETTLEMENT", s.getId(), key + ":capital", "Hoàn capital");
        append(a, "PROFIT", r.profitReceived(), "SETTLEMENT", s.getId(), key + ":profit", "Profit nhiệm vụ");
        append(a, "REWARD", r.rewardReceived(), "SETTLEMENT", s.getId(), key + ":reward", "Reward nhiệm vụ");
        if (r.fee().signum() > 0)
            append(a, "ADJUSTMENT_DECREASE", r.fee().negate(), "SETTLEMENT", s.getId(), key + ":fee", "Phí settlement");
        t.setActualCapitalReturn(money(r.capitalReturned()));
        t.setActualProfit(money(r.profitReceived()));
        t.setActualReward(money(r.rewardReceived()));
        t.setActualCompletionDate(Instant.now());
        t.setStatus("COMPLETED");
        return new OperationResponse(s.getId(), s.getStatus(), dto(a));
    }

    @Transactional
    public OperationResponse requestWithdrawal(Long userId, String key, WithdrawalRequest r) {
        requireKey(key);
        var prior = withdrawals.findByUserIdAndIdempotencyKey(userId, key);
        if (prior.isPresent()) {
            var w = prior.get();
            return new OperationResponse(w.getId(), w.getStatus(), dto(account(w.getInvestmentAccountId(), userId)));
        }
        InvestmentAccount a = account(r.accountId(), userId);
        BigDecimal amount = money(r.requestedAmount());
        if (a.getAvailableCapital().compareTo(amount) < 0)
            throw bad("INSUFFICIENT_AVAILABLE_BALANCE", "Số dư khả dụng không đủ");
        InvestmentWithdrawal w = new InvestmentWithdrawal();
        w.setUserId(userId);
        w.setInvestmentAccountId(a.getId());
        w.setRequestedDate(Instant.now());
        w.setRequestedAmount(amount);
        w.setWithdrawalFee(money(r.fee()));
        w.setExpectedNetAmount(money(amount.subtract(r.fee())));
        w.setDestinationAccount(r.destinationAccount());
        w.setReferenceNumber(r.referenceNumber());
        w.setStatus("PENDING_APPROVAL");
        w.setIdempotencyKey(key);
        withdrawals.save(w);
        a.setAvailableCapital(money(a.getAvailableCapital().subtract(amount)));
        a.setReservedWithdrawal(money(a.getReservedWithdrawal().add(amount)));
        append(a, "WITHDRAWAL_RESERVE", amount.negate(), "WITHDRAWAL", w.getId(), key, "Giữ số dư chờ rút");
        return new OperationResponse(w.getId(), w.getStatus(), dto(a));
    }

    @Transactional
    public OperationResponse completeWithdrawal(Long userId, Long id) {
        InvestmentWithdrawal w = withdrawals.findByIdAndUserIdAndDeletedAtIsNull(id, userId).orElseThrow(() -> missing("WITHDRAWAL_NOT_FOUND"));
        if ("COMPLETED".equals(w.getStatus()))
            return new OperationResponse(w.getId(), w.getStatus(), dto(account(w.getInvestmentAccountId(), userId)));
        if (!"PENDING_APPROVAL".equals(w.getStatus()) && !"PROCESSING".equals(w.getStatus()))
            throw bad("WITHDRAWAL_NOT_COMPLETABLE", "Trạng thái rút tiền không hợp lệ");
        InvestmentAccount a = account(w.getInvestmentAccountId(), userId);
        a.setReservedWithdrawal(money(a.getReservedWithdrawal().subtract(w.getRequestedAmount())));
        a.setCurrentBalance(money(a.getCurrentBalance().subtract(w.getRequestedAmount())));
        w.setActualNetAmount(w.getExpectedNetAmount());
        w.setStatus("COMPLETED");
        append(a, "WITHDRAWAL", w.getRequestedAmount().negate(), "WITHDRAWAL", w.getId(), w.getIdempotencyKey() + ":complete", "Rút tiền hoàn tất");
        if (w.getWithdrawalFee().signum() > 0)
            append(a, "WITHDRAWAL_FEE", w.getWithdrawalFee().negate(), "WITHDRAWAL", w.getId(), w.getIdempotencyKey() + ":fee", "Phí rút tiền");
        return new OperationResponse(w.getId(), w.getStatus(), dto(a));
    }

    @Transactional(readOnly = true)
    public PageResponse<LedgerEntry> ledger(Long userId, Long accountId, Pageable p) {
        account(accountId, userId);
        Page<LedgerEntry> e = ledger.findByUserIdAndInvestmentAccountId(userId, accountId, p);
        return new PageResponse<>(e.getContent(), new PageMeta(e.getNumber(), e.getSize(), e.getTotalElements(), e.getTotalPages()));
    }

    private <T> PageResponse<T> page(Page<T> p) {
        return new PageResponse<>(p.getContent(), new PageMeta(p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages()));
    }

    private InvestmentAccount account(Long id, Long user) {
        return accounts.findByIdAndUserIdAndDeletedAtIsNull(id, user).orElseThrow(() -> missing("INVESTMENT_ACCOUNT_NOT_FOUND"));
    }

    private InvestmentTask task(Long id, Long user) {
        return tasks.findByIdAndUserIdAndDeletedAtIsNull(id, user).orElseThrow(() -> missing("TASK_NOT_FOUND"));
    }

    private void change(InvestmentAccount a, String type, BigDecimal amount, String refType, Long refId, String key, String text) {
        BigDecimal before = a.getCurrentBalance();
        a.setCurrentBalance(money(before.add(amount)));
        appendWithBalances(a, type, amount, refType, refId, key, text, before, a.getCurrentBalance());
    }

    private void append(InvestmentAccount a, String type, BigDecimal amount, String refType, Long refId, String key, String text) {
        appendWithBalances(a, type, money(amount), refType, refId, key, text, a.getCurrentBalance(), a.getCurrentBalance());
    }

    private void appendWithBalances(InvestmentAccount a, String type, BigDecimal amount, String refType, Long refId, String key, String text, BigDecimal before, BigDecimal after) {
        LedgerEntry e = new LedgerEntry();
        e.setUserId(a.getUserId());
        e.setInvestmentAccountId(a.getId());
        e.setEntryDate(Instant.now());
        e.setEntryType(type);
        e.setAmount(money(amount));
        e.setCurrency(a.getCurrency());
        e.setBalanceBefore(before);
        e.setBalanceAfter(after);
        e.setReferenceType(refType);
        e.setReferenceId(refId);
        e.setDescription(text);
        e.setCreatedBy(a.getUserId());
        e.setIdempotencyKey(key);
        ledger.save(e);
    }

    private AccountResponse dto(InvestmentAccount a) {
        return new AccountResponse(a.getId(), a.getPlatformId(), a.getAccountName(), a.getExternalAccountCode(),
                a.getCurrency(), a.getCurrentBalance(), a.getAvailableCapital(), a.getLockedCapital(),
                a.getAccumulatedProfit(), a.getAccumulatedReward(), a.getReservedWithdrawal(), a.getStatus(),
                a.getNote(), a.getVersion());
    }

    private BigDecimal money(BigDecimal n) {
        return n.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal zero(BigDecimal n) {
        return money(n == null ? BigDecimal.ZERO : n);
    }

    private void requireKey(String k) {
        if (k == null || k.isBlank() || k.length() > 100)
            throw bad("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key là bắt buộc");
    }

    private ApiException bad(String c, String m) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, c, m);
    }

    private ApiException missing(String c) {
        return new ApiException(HttpStatus.NOT_FOUND, c, "Không tìm thấy dữ liệu");
    }
}

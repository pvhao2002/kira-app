package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.domain.UserBankBalanceAdjustment;
import com.kira.bank.creditcard.domain.UserBankCreditLimit;
import com.kira.bank.creditcard.infrastructure.StatementRepository;
import com.kira.bank.creditcard.infrastructure.UserBankBalanceAdjustmentRepository;
import com.kira.bank.creditcard.infrastructure.UserBankCreditLimitRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static com.kira.bank.creditcard.application.CreditCardDtos.BankBalanceResponse;
import static com.kira.bank.creditcard.application.CreditCardDtos.BankBalanceUpdateRequest;

@Service
@RequiredArgsConstructor
public class BankBalanceService {
    private final UserBankCreditLimitRepository creditLimits;
    private final UserBankBalanceAdjustmentRepository adjustments;
    private final StatementRepository statements;

    @Transactional(readOnly = true)
    public Map<Long, BigDecimal> currentBalances(Long userId, Collection<Long> bankIds) {
        if (bankIds.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<Long, BigDecimal> baseBalances = baseBalances(userId, bankIds);
        Map<Long, BigDecimal> offsets = latestOffsets(userId, bankIds);
        Map<Long, BigDecimal> result = new HashMap<>();
        bankIds.forEach(bankId -> result.put(bankId,
            effectiveBalance(baseBalances.getOrDefault(bankId, zero()), offsets.getOrDefault(bankId, zero()))));
        return result;
    }

    @Transactional(readOnly = true)
    public BigDecimal currentBalance(Long userId, Long bankId) {
        return currentBalances(userId, java.util.List.of(bankId)).getOrDefault(bankId, zero());
    }

    @Transactional
    public BankBalanceResponse updateBalance(Long userId, Long bankId, BankBalanceUpdateRequest request) {
        UserBankCreditLimit creditLimit = creditLimits.findForBalanceUpdate(userId, bankId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BANK_CREDIT_LIMIT_NOT_FOUND",
                "Không tìm thấy dữ liệu"));
        if (creditLimit.getBalanceVersion() != request.version()) {
            throw versionConflict();
        }

        BigDecimal sourceBalance = baseBalances(userId, java.util.List.of(bankId))
            .getOrDefault(bankId, zero());
        BigDecimal currentOffset = adjustments.findFirstByUserIdAndBankIdOrderByBalanceVersionDesc(userId, bankId)
            .map(UserBankBalanceAdjustment::getBalanceOffset)
            .orElse(zero());
        BigDecimal previousBalance = effectiveBalance(sourceBalance, currentOffset);
        BigDecimal requestedBalance = money(request.currentBalance());
        String bankName = bankName(creditLimit);

        if (requestedBalance.compareTo(previousBalance) == 0) {
            return response(creditLimit, bankName, previousBalance, requestedBalance, zero(),
                creditLimit.getBalanceVersion());
        }

        long nextVersion = creditLimit.getBalanceVersion() + 1;
        UserBankBalanceAdjustment adjustment = new UserBankBalanceAdjustment();
        adjustment.setUserId(userId);
        adjustment.setBankId(bankId);
        adjustment.setBalanceVersion(nextVersion);
        adjustment.setSourceBalance(sourceBalance);
        adjustment.setPreviousBalance(previousBalance);
        adjustment.setNewBalance(requestedBalance);
        adjustment.setAdjustmentAmount(money(requestedBalance.subtract(previousBalance)));
        adjustment.setBalanceOffset(money(requestedBalance.subtract(sourceBalance)));
        adjustment.setReason(request.reason().trim());
        adjustment.setCurrency(creditLimit.getCurrency());
        adjustment.setCreatedAt(Instant.now());
        adjustment.setCreatedBy(userId);
        adjustments.save(adjustment);

        if (creditLimits.updateBalanceVersion(creditLimit.getId(), userId,
            creditLimit.getBalanceVersion(), nextVersion) != 1) {
            throw versionConflict();
        }

        return response(creditLimit, bankName, previousBalance, requestedBalance,
            adjustment.getAdjustmentAmount(), nextVersion);
    }

    private Map<Long, BigDecimal> baseBalances(Long userId, Collection<Long> bankIds) {
        Map<Long, BigDecimal> result = new HashMap<>();
        statements.findCurrentBalancesForBanks(userId, bankIds)
            .forEach(total -> result.put(total.getBankId(), money(total.getCurrentBalance())));
        return result;
    }

    private Map<Long, BigDecimal> latestOffsets(Long userId, Collection<Long> bankIds) {
        Map<Long, BigDecimal> result = new HashMap<>();
        adjustments.findLatestForBanks(userId, bankIds)
            .forEach(adjustment -> result.put(adjustment.getBankId(), money(adjustment.getBalanceOffset())));
        return result;
    }

    private BigDecimal effectiveBalance(BigDecimal sourceBalance, BigDecimal offset) {
        return money(sourceBalance.add(offset).max(BigDecimal.ZERO));
    }

    private BankBalanceResponse response(UserBankCreditLimit creditLimit, String bankName,
                                         BigDecimal previousBalance, BigDecimal currentBalance,
                                         BigDecimal adjustmentAmount, long balanceVersion) {
        return new BankBalanceResponse(creditLimit.getBank().getId(), bankName,
            creditLimit.getBank().getLogoUrl(), previousBalance, currentBalance, adjustmentAmount,
            creditLimit.getCurrency(), balanceVersion);
    }

    private String bankName(UserBankCreditLimit creditLimit) {
        return creditLimit.getBank().getShortName() == null || creditLimit.getBank().getShortName().isBlank()
            ? creditLimit.getBank().getName() : creditLimit.getBank().getShortName();
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
    }

    private ApiException versionConflict() {
        return new ApiException(HttpStatus.CONFLICT, "BANK_BALANCE_VERSION_CONFLICT",
            "Dư nợ ngân hàng đã được cập nhật ở phiên khác");
    }
}

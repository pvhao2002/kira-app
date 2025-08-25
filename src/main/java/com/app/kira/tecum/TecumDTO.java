package com.app.kira.tecum;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TecumDTO {
    private Long tecumAccountId;
    private String tecumName;
    private BigDecimal balance;
    private BigDecimal balanceHolding;
    private BigDecimal balanceLeftDividend;
    private BigDecimal bonus;
    private BigDecimal commission;
    private BigDecimal withdrawal;
    private BigDecimal deposit;
    private BigDecimal profit;
    private String updatedAt;
    private String note;
    @JsonIgnore
    private String tecumUsername;
    @JsonIgnore
    private String tecumPassword;
    @JsonIgnore
    private String tecumCookie;

    public TecumDTO(List<TecumDTO> list) {
        this.tecumName = "Total";
        this.balance = list.stream()
                .map(TecumDTO::getBalance)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        this.balanceHolding = list.stream()
                .map(TecumDTO::getBalanceHolding)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        this.balanceLeftDividend = list.stream()
                .map(TecumDTO::getBalanceLeftDividend)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        this.bonus = list.stream()
                .map(TecumDTO::getBonus)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        this.commission = list.stream()
                .map(TecumDTO::getCommission)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        this.withdrawal = list.stream()
                .map(TecumDTO::getWithdrawal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        this.deposit = list.stream()
                .map(TecumDTO::getDeposit)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        this.profit = list.stream()
                .map(TecumDTO::getProfit)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Transaction {
        private String transactionDate;
        private String amount;
        private String type;
        private String note;
        private String updatedAt;
    }
}

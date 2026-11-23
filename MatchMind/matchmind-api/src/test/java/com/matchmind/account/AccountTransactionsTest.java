package com.matchmind.account;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import static com.matchmind.account.AccountTransactions.*;
import static org.assertj.core.api.Assertions.assertThat;

class AccountTransactionsTest {
    private static Row row(String reference, Type type, Status status, String value) {
        return new Row(reference, type, status, new BigDecimal(value), Instant.parse("2026-11-01T18:00:00Z"));
    }

    @Test void keepsFinalWithdrawalsAndSecondReward() {
        var deposit = row("1", Type.CREDIT, Status.SUCCESS, "100");
        var withdrawal = row("2", Type.DEBIT, Status.SUCCESS, "140");
        var bonus = row("3", Type.REWARD, Status.SUCCESS, "5");
        var cancelled = row("4", Type.DEBIT, Status.CANCELLED, "80");
        var kept = canonical(List.of(deposit, withdrawal, row("2", Type.DEBIT, Status.PENDING, "140"),
            row("3", Type.REWARD, Status.SUCCESS, "15"), bonus, cancelled));
        assertThat(kept).containsExactly(deposit, withdrawal, bonus, cancelled);
    }
}

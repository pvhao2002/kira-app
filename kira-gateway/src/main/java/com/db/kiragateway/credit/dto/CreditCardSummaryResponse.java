package com.db.kiragateway.credit.dto;

import java.math.BigDecimal;

public record CreditCardSummaryResponse(
        BigDecimal totalOutstandingBalance,
        long activeCount
) {
}

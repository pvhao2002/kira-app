package com.db.kiragateway.credit.dto;

import java.util.List;

public record PaymentPageResponse(
        List<CreditCardPaymentResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

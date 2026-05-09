package com.db.kiragateway.transaction.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateReceiptTransactionRequest(
        @NotBlank String imageBase64,
        String fileName,
        String mimeType
) {
}

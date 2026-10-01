package com.kira.farm.account.application;

import java.time.Instant;

/** Delivered order line that has not been reviewed yet (JPQL constructor projection, so top-level). */
public record PendingReviewRow(Long orderId, String orderCode, Long productId, String productName, String slug,
                               String imageUrl, Instant deliveredAt) {
}

package com.kira.farm.order.application;

import com.kira.farm.order.domain.OrderStatus;

/** Orders per status (JPQL constructor expression of the admin order list's status tabs). */
public record StatusCount(OrderStatus status, long count) {
}

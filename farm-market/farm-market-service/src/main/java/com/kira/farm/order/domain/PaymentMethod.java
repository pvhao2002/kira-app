package com.kira.farm.order.domain;

/** No payment gateway: BANK_TRANSFER shows a VietQR image; staff confirm every non-COD payment by hand. */
public enum PaymentMethod {
    COD, BANK_TRANSFER, EWALLET, CARD
}

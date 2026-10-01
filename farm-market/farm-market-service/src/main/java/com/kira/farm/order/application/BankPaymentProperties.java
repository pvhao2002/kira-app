package com.kira.farm.order.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Shop bank account for VietQR transfers (app.payment.bank). Public data by nature (it is printed on the QR), but it
 * is only ever returned on BANK_TRANSFER orders and never logged. Unset means "no QR": the UI shows plain instructions.
 */
@ConfigurationProperties("app.payment.bank")
public record BankPaymentProperties(String bin, String bankCode, String name, String accountNo, String accountName) {

    public BankPaymentProperties {
        bin = clean(bin).isEmpty() ? clean(bankCode) : clean(bin); // VIETQR_BANK_BIN wins over BANK_CODE
        bankCode = clean(bankCode);
        name = clean(name);
        accountNo = clean(accountNo);
        accountName = clean(accountName);
    }

    public boolean configured() {
        return !bin.isEmpty() && !accountNo.isEmpty() && !accountName.isEmpty();
    }

    /** Label shown to the customer; falls back to the bank code/BIN when no friendly name is configured. */
    public String displayName() {
        return name.isEmpty() ? bin : name;
    }

    private static String clean(String v) {
        return v == null ? "" : v.trim();
    }
}

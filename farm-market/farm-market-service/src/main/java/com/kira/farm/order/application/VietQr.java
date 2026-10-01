package com.kira.farm.order.application;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Builds the public VietQR image URL (img.vietqr.io, no API key). Pure function: unit-tested without Spring. */
final class VietQr {
    private VietQr() {
    }

    static String imageUrl(String bank, String accountNo, String accountName, long amountVnd, String transferNote) {
        return "https://img.vietqr.io/image/" + enc(bank) + "-" + enc(accountNo) + "-compact2.png?amount=" + amountVnd
            + "&addInfo=" + enc(transferNote) + "&accountName=" + enc(accountName);
    }

    private static String enc(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8).replace("+", "%20");
    }
}

package com.kira.farm.order.application;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VietQrTest {
    @Test
    void buildsUrlWithAmountNoteAndEncodedAccountName() {
        assertEquals("https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=1250000&addInfo=DN-20260001"
                + "&accountName=NGUY%E1%BB%84N%20V%C4%82N%20A%20%26%20CO",
            VietQr.imageUrl("970436", "0123456789", "NGUYỄN VĂN A & CO", 1_250_000L, "DN-20260001"));
    }

    @Test
    void specialCharactersCannotBreakOutOfTheQuery() {
        String url = VietQr.imageUrl("vcb", "1", "A&amount=1", 5, "X#Y");
        assertTrue(url.endsWith("addInfo=X%23Y&accountName=A%26amount%3D1"), url);
    }

    @Test
    void propertiesAreConfiguredOnlyWhenBinAccountAndNameAreAllSet() {
        assertFalse(new BankPaymentProperties("", "", "", "", "").configured());
        assertFalse(new BankPaymentProperties("970436", null, null, "123", " ").configured());
        var p = new BankPaymentProperties(" 970436 ", "", "", "123", "NGUYEN A");
        assertTrue(p.configured());
        assertEquals("970436", p.displayName());
        assertEquals("vcb", new BankPaymentProperties("", " vcb", "", "1", "A").bin()); // BANK_CODE fallback
        assertEquals("Vietcombank", new BankPaymentProperties("970436", "", "Vietcombank", "1", "A").displayName());
    }
}

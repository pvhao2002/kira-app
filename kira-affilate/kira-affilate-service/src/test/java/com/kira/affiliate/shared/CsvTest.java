package com.kira.affiliate.shared;

import com.kira.affiliate.shared.web.Csv;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CsvTest {
    @Test
    void quotesEscapesAndNeutralisesFormulas() {
        assertEquals("﻿\"Tên, \"\"A\"\"\",\"'=HYPERLINK(1)\",\"-5\",\"'-5\",\"\"\r\n",
            new Csv().row("Tên, \"A\"", "=HYPERLINK(1)", new BigDecimal("-5"), "-5", null).toString());
    }
}

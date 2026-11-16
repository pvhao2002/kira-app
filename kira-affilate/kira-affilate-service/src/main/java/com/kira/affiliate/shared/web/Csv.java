package com.kira.affiliate.shared.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

public final class Csv {
    private final StringBuilder out = new StringBuilder("﻿"); // BOM: Excel reads Vietnamese as UTF-8

    public Csv row(Object... cells) {
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) out.append(',');
            out.append(cells[i] == null ? "\"\"" : cell(cells[i]));
        }
        out.append("\r\n");
        return this;
    }

    static String cell(Object value) {
        if (value == null) return "";
        String text = value.toString();
        // Spreadsheet formula injection: neutralise cells a spreadsheet would evaluate.
        if (!(value instanceof Number) && !text.isEmpty() && "=+-@\t\r".indexOf(text.charAt(0)) >= 0) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    public ResponseEntity<byte[]> download(String filename) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
            .body(out.toString().getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public String toString() {
        return out.toString();
    }
}

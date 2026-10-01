package com.kira.farm.catalog.application;

import java.text.Normalizer;
import java.util.Locale;

public final class Slugs {
    private Slugs() {
    }

    /** "Trứng gà ta – 10 quả" -> "trung-ga-ta-10-qua". */
    public static String slugify(String text) {
        String s = Normalizer.normalize(text.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-+|-+$", "");
        return s.isEmpty() ? "san-pham" : s;
    }
}

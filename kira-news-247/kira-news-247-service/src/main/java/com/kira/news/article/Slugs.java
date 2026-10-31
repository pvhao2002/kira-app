package com.kira.news.article;

import java.text.Normalizer;
import java.util.Locale;

public final class Slugs {
    private static final int MAX = 150;

    private Slugs() {
    }

    /** "Đường sắt Bắc – Nam" -> "duong-sat-bac-nam". */
    public static String of(String text) {
        var ascii = Normalizer.normalize(text.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        var slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        return slug.length() <= MAX ? slug : slug.substring(0, MAX).replaceAll("-+$", "");
    }
}

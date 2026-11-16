package com.kira.affiliate.shared.web;

import java.util.List;

import static com.kira.affiliate.shared.web.ApiTypes.PageMeta;
import static com.kira.affiliate.shared.web.ApiTypes.PageResponse;

public final class Paging {
    public static final int MAX_SIZE = 100;

    private Paging() {
    }

    public static int page(int page) {
        return Math.max(page, 0);
    }

    public static int size(int size) {
        return Math.min(Math.max(size, 1), MAX_SIZE);
    }

    public static <T> PageResponse<T> response(List<T> data, int page, int size, long total) {
        return new PageResponse<>(data, new PageMeta(page, size, total, (int) Math.ceil(total / (double) size)));
    }

    /** Escapes LIKE wildcards so user text is matched literally (MySQL default escape char is backslash). */
    public static String contains(String text) {
        return "%" + text.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}

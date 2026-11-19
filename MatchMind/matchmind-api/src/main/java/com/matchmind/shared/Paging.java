package com.matchmind.shared;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.util.List;
import java.util.Map;

import static com.matchmind.shared.ApiTypes.PageMeta;
import static com.matchmind.shared.ApiTypes.PageResponse;

public final class Paging {
    public static final int MAX_SIZE = 200;

    private Paging() {
    }

    public static int page(Integer page) {
        return page == null ? 0 : Math.max(page, 0);
    }

    public static int size(Integer size) {
        return size == null ? 20 : Math.min(Math.max(size, 1), MAX_SIZE);
    }

    /** Binds :limit and :offset for one page; queries end with {@code LIMIT :limit OFFSET :offset}. */
    public static void limit(MapSqlParameterSource params, int page, int size) {
        params.addValue("limit", size).addValue("offset", (long) page * size);
    }

    public static <T> PageResponse<T> response(List<T> data, int page, int size, long total) {
        return new PageResponse<>(data, new PageMeta(page, size, total, (int) Math.ceil(total / (double) size)));
    }

    /** ILIKE pattern that matches user text literally (PostgreSQL default escape char is backslash). */
    public static String contains(String text) {
        return "%" + text.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    /** Maps a client sort key ("field,asc|desc") to a whitelisted SQL expression; unknown keys use the fallback. */
    public static String orderBy(String sort, Map<String, String> allowed, String fallback) {
        if (sort == null || sort.isBlank()) return fallback;
        String[] parts = sort.split(",");
        String column = allowed.get(parts[0].trim());
        if (column == null) return fallback;
        String dir = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim()) ? "ASC" : "DESC";
        return column + " " + dir + " NULLS LAST";
    }
}

package com.kira.farm.shared.web;

import org.springframework.data.domain.Page;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

public final class ApiTypes {
    private ApiTypes() {
    }

    public record PageMeta(int page, int size, long totalElements, int totalPages) {
        public static PageMeta of(Page<?> page) {
            return new PageMeta(page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
        }

        /** Meta of a request that matched nothing (e.g. empty branch scope). */
        public static PageMeta empty(int page, int size) {
            return new PageMeta(page, size, 0, 0);
        }
    }

    public record PageResponse<T>(List<T> data, PageMeta meta) {
        public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
            return new PageResponse<>(page.getContent().stream().map(mapper).toList(), PageMeta.of(page));
        }

        /** Page meta of {@code page} with rows already mapped by the caller (batch-assembled responses). */
        public static <T> PageResponse<T> of(Page<?> page, List<T> data) {
            return new PageResponse<>(data, PageMeta.of(page));
        }
    }

    public record ErrorResponse(Instant timestamp, int status, String code, String message,
                                Map<String, String> fieldErrors, String path, String traceId) {
    }
}

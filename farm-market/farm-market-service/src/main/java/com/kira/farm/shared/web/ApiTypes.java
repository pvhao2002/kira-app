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
    }

    public record PageResponse<T>(List<T> data, PageMeta meta) {
        public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
            return new PageResponse<>(page.getContent().stream().map(mapper).toList(),
                new PageMeta(page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
        }
    }

    public record ErrorResponse(Instant timestamp, int status, String code, String message,
                                Map<String, String> fieldErrors, String path, String traceId) {
    }
}

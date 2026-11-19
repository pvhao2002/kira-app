package com.matchmind.shared;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Response envelopes shared by every endpoint: lists are {data, meta}, errors are ErrorResponse. */
public final class ApiTypes {
    private ApiTypes() {
    }

    public record PageMeta(int page, int size, long totalElements, int totalPages) {
    }

    public record PageResponse<T>(List<T> data, PageMeta meta) {
    }

    public record ErrorResponse(Instant timestamp, int status, String code, String message,
                                Map<String, String> fieldErrors, String path, String traceId) {
    }
}

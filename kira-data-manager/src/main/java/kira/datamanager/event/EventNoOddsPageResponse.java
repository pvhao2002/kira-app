package kira.datamanager.event;

import java.util.List;

public record EventNoOddsPageResponse(
        List<EventNoOddsRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

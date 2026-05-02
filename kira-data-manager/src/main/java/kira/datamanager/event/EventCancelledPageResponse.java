package kira.datamanager.event;

import java.util.List;

public record EventCancelledPageResponse(
        List<EventCancelledRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

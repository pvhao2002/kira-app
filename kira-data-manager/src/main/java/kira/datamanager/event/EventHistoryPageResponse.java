package kira.datamanager.event;

import java.util.List;

public record EventHistoryPageResponse(
        List<EventHistoryRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

package kira.datamanager.event;

import java.util.List;

public record EventCrawlFailedPageResponse(
        List<EventCrawlFailedRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

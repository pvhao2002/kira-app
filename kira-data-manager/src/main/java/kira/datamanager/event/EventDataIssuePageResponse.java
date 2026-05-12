package kira.datamanager.event;

import java.util.List;

public record EventDataIssuePageResponse(
        List<EventDataIssueRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

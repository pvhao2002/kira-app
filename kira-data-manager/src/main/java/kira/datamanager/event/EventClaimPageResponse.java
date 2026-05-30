package kira.datamanager.event;

import java.util.List;

public record EventClaimPageResponse(
        List<EventClaimRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

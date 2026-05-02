package kira.datamanager.team;

import java.util.List;

public record TeamPageResponse(
        List<TeamRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

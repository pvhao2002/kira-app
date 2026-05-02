package kira.datamanager.league;

import java.util.List;

public record LeaguePageResponse(
        List<LeagueRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

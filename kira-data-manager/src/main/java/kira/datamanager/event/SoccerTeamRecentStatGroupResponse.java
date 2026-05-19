package kira.datamanager.event;

import java.util.List;

public record SoccerTeamRecentStatGroupResponse(
        String metricType,
        List<SoccerTeamRecentStatRowResponse> rows
) {
}

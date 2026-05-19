package kira.datamanager.event;

import java.util.List;

public record SoccerTeamRecentStatResponse(
        List<SoccerTeamRecentStatGroupResponse> groups
) {
}

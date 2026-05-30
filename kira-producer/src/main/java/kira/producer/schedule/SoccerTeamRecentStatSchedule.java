package kira.producer.schedule;

import kira.producer.service.SoccerTeamRecentStatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "kira.producer.soccer-team-recent-stat.enabled", havingValue = "true", matchIfMissing = true)
public class SoccerTeamRecentStatSchedule {

    private final SoccerTeamRecentStatService soccerTeamRecentStatService;

    @Scheduled(cron = "0 30 2 * * *", zone = "Asia/Ho_Chi_Minh")
    public void recomputeRecentStats() {
        var insertedRows = soccerTeamRecentStatService.recomputeRecentStats();
        log.info("SoccerTeamRecentStatSchedule >> Recomputed recent team stats, inserted rows: " + insertedRows);
    }
}

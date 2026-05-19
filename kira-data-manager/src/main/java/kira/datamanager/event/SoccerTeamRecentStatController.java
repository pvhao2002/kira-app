package kira.datamanager.event;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Soccer statistic APIs under servlet context {@code /data}. */
@RestController
@RequestMapping
public class SoccerTeamRecentStatController {

    private final SoccerTeamRecentStatRepository soccerTeamRecentStatRepository;

    public SoccerTeamRecentStatController(SoccerTeamRecentStatRepository soccerTeamRecentStatRepository) {
        this.soccerTeamRecentStatRepository = soccerTeamRecentStatRepository;
    }

    @GetMapping("/soccer/team-recent-stats")
    public ResponseEntity<SoccerTeamRecentStatResponse> latest() {
        return ResponseEntity.ok(soccerTeamRecentStatRepository.findLatest());
    }
}

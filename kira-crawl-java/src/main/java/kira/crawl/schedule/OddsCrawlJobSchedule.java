package kira.crawl.schedule;

import kira.crawl.service.OddsCrawlJobService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.logging.Level;
import java.util.logging.Logger;

@Service
@ConditionalOnProperty(name = "app.odds-crawl-job.enabled", havingValue = "true")
public class OddsCrawlJobSchedule {

    private static final Logger log = Logger.getLogger(OddsCrawlJobSchedule.class.getName());

    private final OddsCrawlJobService oddsCrawlJobService;

    public OddsCrawlJobSchedule(OddsCrawlJobService oddsCrawlJobService) {
        this.oddsCrawlJobService = oddsCrawlJobService;
    }

    @Scheduled(fixedDelayString = "${app.odds-crawl-job.fixed-delay-seconds:60}000", initialDelay = 10_000)
    public void runOddsCrawlJob() {
        try {
            oddsCrawlJobService.processNext();
        } catch (Exception ex) {
            log.log(Level.WARNING, "OddsCrawlJobSchedule tick failed", ex);
        }
    }
}

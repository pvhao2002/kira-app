//package kira.crawl.service;
//
//import kira.crawl.client.GatewayOddsClient;
//import kira.crawl.config.OddsCrawlJobProperties;
//import kira.crawl.dto.MatchOddsResponseDto;
//import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
//import org.springframework.stereotype.Service;
//
//import java.util.Map;
//import java.util.logging.Level;
//import java.util.logging.Logger;
//
//@Service
//@ConditionalOnProperty(name = "app.odds-crawl-job.enabled", havingValue = "true")
//public class OddsCrawlJobService {
//
//    private static final Logger log = Logger.getLogger(OddsCrawlJobService.class.getName());
//
//    private final GatewayOddsClient gatewayOddsClient;
//    private final MatchesService matchesService;
//    private final OddsCrawlJobProperties jobProperties;
//
//    public OddsCrawlJobService(
//            GatewayOddsClient gatewayOddsClient,
//            MatchesService matchesService,
//            OddsCrawlJobProperties jobProperties
//    ) {
//        this.gatewayOddsClient = gatewayOddsClient;
//        this.matchesService = matchesService;
//        this.jobProperties = jobProperties;
//    }
//
//    public void processNext() {
//        var claimed = gatewayOddsClient.claimNext(jobProperties.instanceId());
//        if (claimed.isEmpty()) {
//            return;
//        }
//
//        var event = claimed.get();
//        log.info("OddsCrawlJob claimed eventId=%d link=%s".formatted(event.eventId(), event.link()));
//
//        try {
//            var raw = matchesService.findMatchOdds(event.link(), event.hasOddsCorner());
//            if (raw instanceof Map<?, ?> emptyMap && emptyMap.isEmpty()) {
//                gatewayOddsClient.recordNoOdds(event.eventId());
//                gatewayOddsClient.reportFail(event.eventId(), "empty", "No Bet365 odds");
//                log.warning("OddsCrawlJob empty odds for eventId=%d".formatted(event.eventId()));
//                return;
//            }
//            if (!(raw instanceof MatchOddsResponseDto result)) {
//                gatewayOddsClient.reportFail(event.eventId(), "invalid_response",
//                        "Unexpected crawl response type: " + (raw == null ? "null" : raw.getClass().getName()));
//                return;
//            }
//            if (result.isEmpty()) {
//                gatewayOddsClient.recordNoOdds(event.eventId());
//                gatewayOddsClient.reportFail(event.eventId(), "empty", "No Bet365 odds");
//                log.warning("OddsCrawlJob empty odds for eventId=%d".formatted(event.eventId()));
//                return;
//            }
//
//            gatewayOddsClient.submitResult(event.eventId(), result);
//            log.info("OddsCrawlJob saved eventId=%d matchId=%s".formatted(event.eventId(), result.matchId()));
//        } catch (Exception ex) {
//            log.log(Level.WARNING, "OddsCrawlJob failed eventId=%d".formatted(event.eventId()), ex);
//            gatewayOddsClient.reportFail(event.eventId(), "crawl_error",
//                    ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName());
//        }
//    }
//}

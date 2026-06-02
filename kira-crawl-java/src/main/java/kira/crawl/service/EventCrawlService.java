package kira.crawl.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.microsoft.playwright.Page;
import kira.crawl.browser.AiscorePageFetchClient;
import kira.crawl.dto.CrawlMatchOddsEventDto;
import kira.crawl.dto.MatchOddsResponseDto;
import kira.crawl.mapper.MatchMapper;
import kira.crawl.mapper.OddsMapper;
import kira.crawl.playwright.PlaywrightManager;
import kira.crawl.protobuf.AiscoreProtobufService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import static kira.crawl.util.JsonRecords.isEmptyObject;

@Service
@RequiredArgsConstructor
@Slf4j
public class EventCrawlService {
    private final PlaywrightManager playwrightManager;
    private final AiscorePageFetchClient aiscorePageFetchClient;
    private final AiscoreProtobufService aiscoreProtobufService;
    private final MatchMapper matchMapper;
    private final OddsMapper oddsMapper;

    private static final String ODD_LIST = "https://api.aiscore.com/v1/web/api/match/odds_list?match_id=%s&code=195";
    private static final String ODD_DETAIL = "https://api.aiscore.com/v1/web/api/match/odds/detail?match_id=%s&cid=2&odds_type=%s";
    private static final String TEAM_STATS = "https://api.aiscore.com/v1/web/api/match/team_stats?match_id=%s";
    private static final List<String> ODDS_TYPE_LIST = List.of("asia", "bs", "corner");

    public Object crawlEvent(String matchId) {
        long crawlStart = System.nanoTime();
        var lane = playwrightManager.getEventLane();
        var page = lane.getPage();
        var oddListUrl = ODD_LIST.formatted(matchId);
        var teamStatsUrl = TEAM_STATS.formatted(matchId);

        var oddListBody = aiscorePageFetchClient.fetchOptional(page, oddListUrl);
        var oddsList = aiscoreProtobufService.decodeMatchOdds(oddListBody);
        if (!oddsMapper.hasBet365Company(oddsList)) {
            log.info(
                    "MatchOdds timing summary matchId={} outcome=noBet365 totalSec={}",
                    matchId,
                    formatDurationSec(crawlStart)
            );
            return Map.of();
        }
        var oddsDetails = fetchOddsDetailTabs(page, matchId);
        var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
        var teamStatsBody = aiscorePageFetchClient.fetchOptional(page, teamStatsUrl);
        var teamStats = aiscoreProtobufService.decodeMatchTeamStats(teamStatsBody);
        var eventResult = matchMapper.mapEventResultFromCrawl(
                List.of(),
                List.of(),
                teamStats
        );
        var response = new MatchOddsResponseDto(
                matchId,
                new CrawlMatchOddsEventDto(null, 0),
                eventResult,
                !timelineOdds.isEmpty()
                        ? oddsMapper.mapOddsForDatabase(oddsDetails)
                        : oddsMapper.mapOddsListForDatabase(oddsList),
                oddsMapper.groupOddsTimelineForResponse(timelineOdds),
                null
        );
        log.info(
                "MatchOdds timing summary matchId={} outcome=success totalSec={}",
                matchId,
                formatDurationSec(crawlStart)
        );
        return response;
    }

    private OddsMapper.OddsDetails fetchOddsDetailTabs(Page p, String matchId) {
        JsonNode asia = null;
        JsonNode bs = null;
        JsonNode corner = null;
        for (var type : ODDS_TYPE_LIST) {
            var body = aiscorePageFetchClient.fetchOptional(p, ODD_DETAIL.formatted(matchId, type));
            if (body == null) {
                continue;
            }
            var decoded = decodeOddsDetailBody(body);
            switch (type) {
                case "asia" -> asia = decoded;
                case "bs" -> bs = decoded;
                case "corner" -> corner = decoded;
                default -> {
                }
            }
        }
        return new OddsMapper.OddsDetails(asia, null, bs, corner);
    }

    private static String formatDurationSec(long startNano) {
        return "%.3f".formatted((System.nanoTime() - startNano) / 1_000_000_000.0);
    }

    private JsonNode decodeOddsDetailBody(byte[] body) {
        var decoded = aiscoreProtobufService.decodeMatchOddsDetail(body);
        return isEmptyObject(decoded) ? null : decoded;
    }
}

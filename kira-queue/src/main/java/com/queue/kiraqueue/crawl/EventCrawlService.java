package com.queue.kiraqueue.crawl;

import com.fasterxml.jackson.databind.JsonNode;
import com.microsoft.playwright.Page;
import com.queue.kiraqueue.browser.AiscorePageFetchClient;
import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.dto.aiscore.MatchOddsResponseDto;
import com.queue.kiraqueue.mapper.OddsMapper;
import com.queue.kiraqueue.playwright.PlaywrightManager;
import com.queue.kiraqueue.protobuf.AiscoreProtobufService;
import com.queue.kiraqueue.service.CrawEventServiceV2;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.queue.kiraqueue.util.JsonRecords.isEmptyObject;


@Service
@RequiredArgsConstructor
@Slf4j
public class EventCrawlService {
    private final PlaywrightManager playwrightManager;
    private final AiscorePageFetchClient aiscorePageFetchClient;
    private final AiscoreProtobufService aiscoreProtobufService;
    private final OddsMapper oddsMapper;

    private static final String ODD_LIST = "https://api.aiscore.com/v1/web/api/match/odds_list?match_id=%s&code=195";
    private static final String ODD_DETAIL = "https://api.aiscore.com/v1/web/api/match/odds/detail?match_id=%s&cid=2&odds_type=%s";
    private static final List<String> ODDS_TYPE_LIST = List.of("asia", "bs", "corner");
    private static final double DEFAULT_WAIT_MS = 100;

    public MatchOddsResponseDto crawlEvent(String matchId, CrawEventServiceV2.EventRow event) {
        return playwrightManager.getEventLane().withPage(page -> crawlEvent(page, matchId, event));
    }

    private MatchOddsResponseDto crawlEvent(Page page, String matchId, CrawEventServiceV2.EventRow event) {
        long crawlStart = System.nanoTime();

        var oddListUrl = ODD_LIST.formatted(matchId);
        var oddListBody = aiscorePageFetchClient.fetchOptional(page, oddListUrl);
        if (oddListBody == null || oddListBody.length == 0) {
            log.warn(
                    "MatchOdds timing summary matchId={} outcome=fetchFailed totalSec={}",
                    matchId,
                    formatDurationSec(crawlStart)
            );
            return MatchOddsResponseDto.empty();
        }
        var oddsList = aiscoreProtobufService.decodeMatchOdds(oddListBody);
        if (!oddsMapper.hasBet365Company(oddsList)) {
            log.info(
                    "MatchOdds timing summary matchId={} outcome=noBet365 totalSec={}",
                    matchId,
                    formatDurationSec(crawlStart)
            );
            return MatchOddsResponseDto.empty();
        }
        var response = mapOddsDecoded(matchId, oddsList, fetchOddsDetailTabs(page, event), event.hasOddsCorner());
        log.info(
                "MatchOdds timing summary matchId={} outcome=success totalSec={}",
                matchId,
                formatDurationSec(crawlStart)
        );
        return response;
    }

    /** Pure decode + map of already-fetched bodies. Empty when no Bet365; throws when a required detail tab is missing. */
    public MatchOddsResponseDto mapOdds(String matchId, byte[] oddsListBody, Map<String, byte[]> details) {
        var oddsList = aiscoreProtobufService.decodeMatchOdds(oddsListBody);
        if (!oddsMapper.hasBet365Company(oddsList)) {
            return MatchOddsResponseDto.empty();
        }
        return mapOddsDecoded(matchId, oddsList, details, false);
    }

    private MatchOddsResponseDto mapOddsDecoded(String matchId, JsonNode oddsList, Map<String, byte[]> details,
                                                boolean requireCorner) {
        // Distinguish a silently-failed fetch (mid-crawl block) from a genuinely empty
        // odds-detail payload: propagate so the caller keeps existing timeline rows
        // instead of persisting a partial result.
        for (var required : requireCorner ? ODDS_TYPE_LIST : List.of("asia", "bs")) {
            if (details == null || details.get(required) == null) {
                throw new BusinessException(
                        "AISCORE_ODDS_DETAIL_FETCH_FAILED: odds detail fetch returned no body for type=" + required
                                + ", matchId=" + matchId);
            }
        }
        var oddsDetails = new OddsMapper.OddsDetails(
                decodeOddsDetailBody(details.get("asia")),
                null,
                decodeOddsDetailBody(details.get("bs")),
                details.get("corner") == null ? null : decodeOddsDetailBody(details.get("corner")));
        var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
        return new MatchOddsResponseDto(
                matchId,
                null,
                null,
                oddsMapper.mapOddsListForDatabase(oddsList),
                oddsMapper.groupOddsTimelineForResponse(timelineOdds),
                null
        );
    }

    private Map<String, byte[]> fetchOddsDetailTabs(Page page, CrawEventServiceV2.EventRow event) {
        Map<String, byte[]> bodies = new HashMap<>();
        for (var type : ODDS_TYPE_LIST) {
            if (!event.hasOddsCorner() && type.equals("corner")) {
                continue;
            }
            var body = aiscorePageFetchClient.fetchOptional(page, ODD_DETAIL.formatted(event.matchId(), type));
            page.waitForTimeout(DEFAULT_WAIT_MS);
            if (body != null) {
                bodies.put(type, body);
            }
        }
        return bodies;
    }

    private static String formatDurationSec(long startNano) {
        return "%.3f".formatted((System.nanoTime() - startNano) / 1_000_000_000.0);
    }

    private JsonNode decodeOddsDetailBody(byte[] body) {
        var decoded = aiscoreProtobufService.decodeMatchOddsDetail(body);
        return isEmptyObject(decoded) ? null : decoded;
    }
}

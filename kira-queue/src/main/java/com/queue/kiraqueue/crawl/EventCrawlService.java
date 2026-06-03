package com.queue.kiraqueue.crawl;

import com.fasterxml.jackson.databind.JsonNode;
import com.microsoft.playwright.Page;
import com.queue.kiraqueue.browser.AiscorePageFetchClient;
import com.queue.kiraqueue.dto.aiscore.MatchOddsResponseDto;
import com.queue.kiraqueue.mapper.OddsMapper;
import com.queue.kiraqueue.playwright.PlaywrightLane;
import com.queue.kiraqueue.playwright.PlaywrightManager;
import com.queue.kiraqueue.protobuf.AiscoreProtobufService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

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

    public MatchOddsResponseDto crawlEvent(String matchId) {
        long crawlStart = System.nanoTime();
        var lane = playwrightManager.getEventLane();
        var oddListUrl = ODD_LIST.formatted(matchId);
        var oddListBody = fetchOddsListWithRetry(lane, oddListUrl);
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
        var oddsDetails = lane.withPage(page -> {
            page.waitForTimeout(DEFAULT_WAIT_MS);
            return fetchOddsDetailTabs(page, matchId);
        });
        var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
        var response = new MatchOddsResponseDto(
                matchId,
                null,
                null,
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

    private byte[] fetchOddsListWithRetry(PlaywrightLane lane, String oddListUrl) {
        var body = lane.withPage(page -> aiscorePageFetchClient.fetchOptional(page, oddListUrl));
        if (body != null && body.length > 0) {
            return body;
        }
        lane.ensureReady();
        return lane.withPage(page -> aiscorePageFetchClient.fetchOptional(page, oddListUrl));
    }

    private OddsMapper.OddsDetails fetchOddsDetailTabs(Page page, String matchId) {
        JsonNode asia = null;
        JsonNode bs = null;
        JsonNode corner = null;
        for (var type : ODDS_TYPE_LIST) {
            var body = aiscorePageFetchClient.fetchOptional(page, ODD_DETAIL.formatted(matchId, type));
            page.waitForTimeout(DEFAULT_WAIT_MS);
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

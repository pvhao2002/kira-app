package kira.crawl.service;

import kira.crawl.browser.AiscorePageFetchClient;
import kira.crawl.dto.MatchesResponseDto;
import kira.crawl.mapper.MatchMapper;
import kira.crawl.playwright.PlaywrightLane;
import kira.crawl.playwright.PlaywrightManager;
import kira.crawl.protobuf.AiscoreProtobufService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

import static kira.crawl.util.JsonRecords.*;

@Service
@RequiredArgsConstructor
public class DateCrawlService {
    private final PlaywrightManager playwrightManager;
    private final AiscorePageFetchClient aiscorePageFetchClient;
    private final AiscoreProtobufService aiscoreProtobufService;
    private final MatchMapper matchMapper;
    private static final String DATE_URL_TEMPLATE = "https://api.aiscore.com/v1/web/api/matches?lang=2&sport_id=1&date=%s&tz=07:00";

    public Object crawlDate(String date) {
        var lane = playwrightManager.getLaneByDate();
        var finalUrl = DATE_URL_TEMPLATE.formatted(date);
        var body = aiscorePageFetchClient.fetchOptional(lane.getPage(), finalUrl);
        var decoded = aiscoreProtobufService.decodeMatches(body);
        var matches = asArray(decoded.get("matches"));
        var events = matches.stream()
                .map(match -> matchMapper.mapDatabaseEvent(match, decoded))
                .toList();

        return new MatchesResponseDto(
                date,
                1,
                2,
                "07:00",
                matches.size(),
                events,
                null
        );
    }

}

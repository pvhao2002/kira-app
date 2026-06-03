package com.queue.kiraqueue.crawl;

import com.queue.kiraqueue.browser.AiscorePageFetchClient;
import com.queue.kiraqueue.dto.aiscore.MatchesResponseDto;
import com.queue.kiraqueue.mapper.MatchMapper;
import com.queue.kiraqueue.playwright.PlaywrightManager;
import com.queue.kiraqueue.protobuf.AiscoreProtobufService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static com.queue.kiraqueue.util.JsonRecords.asArray;

@Service
@RequiredArgsConstructor
public class DateCrawlService {
    private final PlaywrightManager playwrightManager;
    private final AiscorePageFetchClient aiscorePageFetchClient;
    private final AiscoreProtobufService aiscoreProtobufService;
    private final MatchMapper matchMapper;
    private static final String DATE_URL_TEMPLATE = "https://api.aiscore.com/v1/web/api/matches?lang=2&sport_id=1&date=%s&tz=07:00";

    public MatchesResponseDto crawlDate(String date) {
        var lane = playwrightManager.getLaneByDate();
        var finalUrl = DATE_URL_TEMPLATE.formatted(date);
        var body = lane.withPage(page -> aiscorePageFetchClient.fetchOptional(page, finalUrl));
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

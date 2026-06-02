package kira.crawl.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import kira.crawl.dto.MatchOddsResponseDto;
import kira.crawl.dto.MatchesResponseDto;
import kira.crawl.playwright.PlaywrightManager;
import kira.crawl.service.DateCrawlService;
import kira.crawl.service.EventCrawlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/crawl")
@RequiredArgsConstructor
public class CrawlController {
    private final DateCrawlService dateCrawlService;
    private final EventCrawlService eventCrawlService;

    @GetMapping("date/{date}")
    public Object getMatchesByDate(@PathVariable String date) {
        return dateCrawlService.crawlDate(date);
    }


    @GetMapping("event/{matchId}")
    public Object getMatchByEventId(@PathVariable String matchId) {
        return eventCrawlService.crawlEvent(matchId);
    }

}

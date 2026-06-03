package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.crawl.DateCrawlService;
import com.queue.kiraqueue.crawl.EventCrawlService;
import com.queue.kiraqueue.service.CrawDateServiceV2;
import com.queue.kiraqueue.service.CrawEventServiceV2;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("gen")
@RequiredArgsConstructor
public class CrawlController {
    private final CrawDateServiceV2 crawDateServiceV2;
    private final CrawEventServiceV2 crawEventServiceV2;

    private final DateCrawlService dateCrawlService;
    private final EventCrawlService eventCrawlService;

    @GetMapping("dates")
    public Object getDates(@RequestParam("d") String d) {
        return dateCrawlService.crawlDate(d);
    }

    @GetMapping("events")
    public Object getEvents(@RequestParam("e") String matchId) {
        return eventCrawlService.crawlEvent(matchId);
    }
}

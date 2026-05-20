package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.service.CrawDateServiceV2;
import com.queue.kiraqueue.service.CrawEventServiceV2;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("gen")
@RequiredArgsConstructor
public class CrawlController {
    private final CrawDateServiceV2 crawDateServiceV2;
    private final CrawEventServiceV2 crawEventServiceV2;

    @GetMapping("dates")
    public Object getDates(@RequestParam("d") List<String> d) {
        crawDateServiceV2.crawlDate(d);
        return Map.of("status", "done", "dates", d);
    }

    @GetMapping("events")
    public Object getEvents(@RequestParam("e") List<Long> e) {
        var results = e.stream().map(id -> Map.of("eventId", id, "success", crawEventServiceV2.processEvent(id))).toList();
        return Map.of("status", "done", "results", results);
    }
}

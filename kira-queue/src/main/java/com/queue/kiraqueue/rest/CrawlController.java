package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.service.CrawDateService;
import com.queue.kiraqueue.service.CrawEventService;
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
    private final CrawDateService crawDateService;
    private final CrawEventService eventService;

    @GetMapping("dates")
    public Object getDates(@RequestParam("d") List<String> d) {
        crawDateService.crawlDate(d);
        return Map.of("status", "done");
    }

    @GetMapping("events")
    public Object getEvents(@RequestParam("e") List<Long> e) {
        eventService.processEvent(e.getFirst());
        return Map.of("status", "done");
    }
}

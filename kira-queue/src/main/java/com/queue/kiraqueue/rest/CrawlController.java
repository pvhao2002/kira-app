package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.service.CrawDateService;
import com.queue.kiraqueue.service.CrawEventService;
import com.queue.kiraqueue.service.PredictService;
import com.queue.kiraqueue.util.DateUtil;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("gen")
@RequiredArgsConstructor
public class CrawlController {
    private final CrawDateService crawDateService;
    private final CrawEventService eventService;
    private final PredictService predictService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @GetMapping("events")
    public Object getEvents() {
        return crawDateService.getAllEvents();
    }

    @GetMapping("dates")
    public Object getDates(@RequestParam("d") List<String> d) {
        crawDateService.crawlDate(d);
        return Map.of("status", "done");
    }

    @GetMapping("upcoming")
    public Object getUpcoming() {
        return Map.of("status", "done");
    }

    @GetMapping("event-analyst")
    public Object getEventAnalyst() {
        return Map.of("status", "done");
    }

    @GetMapping("up-coming-event/{eventId}")
    public Object getUpComingEvent(@PathVariable String eventId) {
        return Map.of("status", "done");
    }

    @GetMapping("predict/{eventId}")
    public Object getPredict(@PathVariable String eventId) {
        predictService.predict(eventId);
        return Map.of("status", "done");
    }


    @Data
    public static class ParlayPredict {
        private String ftScoreStr;
        private Integer ftTotalGoal;
        private Integer scoreCount;
        private String cornerStr;
        private Integer totalCorner;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EventParlayResult {
        private String eventId;
        private String leagueName;
        private String eventName;
        private String eventDate;
        private String lastOu;
        private String lastHdc;
        private String lastCorner;
        private String scores;

        // Các cột kết quả đã concat ở SQL
        private String totalResultHome;
        private String totalResultOver;
        private String totalCornerOver;
    }
}

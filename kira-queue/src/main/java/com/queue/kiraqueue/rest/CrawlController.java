package com.queue.kiraqueue.rest;

import com.google.common.collect.Lists;
import com.queue.kiraqueue.dto.Event;
import com.queue.kiraqueue.dto.RawEventAnalyst;
import com.queue.kiraqueue.service.CrawDateService;
import com.queue.kiraqueue.service.CrawEventService;
import com.queue.kiraqueue.service.PredictService;
import com.queue.kiraqueue.util.DateUtil;
import com.queue.kiraqueue.util.OddConverter;
import io.micrometer.common.util.StringUtils;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@RestController
@RequestMapping("gen")
@RequiredArgsConstructor
public class CrawlController {
    private final CrawDateService crawDateService;
    private final CrawEventService eventService;
    private final PredictService predictService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @GetMapping("upcoming")
    public Object getUpcoming() {
        crawDateService.crawlTomorrowEventToPredict(DateUtil.getTodayDate());
        crawDateService.crawlTomorrowEventToPredict(DateUtil.getTomorrowDate());
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

    @GetMapping("parlay")
    public Object parlay() {
        var sql = """
                 select e.event_id,
                        e.event_name,
                        e.league_name,
                        e.event_date,
                        e.last_ou,
                        e.last_hdc,
                        e.last_corner,
                
                        p.scores,
                        CONCAT(p.total_result_home, '/5', ' of ', total_result_score)  as total_result_home,
                        CONCAT(p.total_result_over, '/5', ' of ', total_result_score)  as total_result_over,
                        CONCAT(p.total_corner_over, '/5', ' of ', total_result_corner) as total_corner_over
                 from events e
                          inner join parlay_predict p on p.event_id = e.event_id
                 where true
                   and total_result_score > 0
                   and event_date >= CONVERT_TZ(NOW() - interval 15 minute, 'SYSTEM', '+07:00')
                 ORDER BY e.event_date, total_result_score
                """;
        return jdbcTemplate.query(sql, new BeanPropertyRowMapper<>(EventParlayResult.class));
    }

//    @Scheduled(fixedDelay = 1, timeUnit = TimeUnit.MINUTES)
    public void scheduledInitParlay() {
        var sql = """
                select *
                from events
                where true
                  -- and last_update < NOW() - INTERVAL 30 MINUTE
                and (first_ou is null or last_hdc is null)
                """;
        var events = jdbcTemplate.query(sql, BeanPropertyRowMapper.newInstance(Event.class));
        if (!events.isEmpty()) {
            try (ExecutorService executor = Executors.newFixedThreadPool(7)) {
                List<List<Event>> partitions = Lists.partition(events, events.size() / 7);

                for (List<Event> part : partitions) {
                    executor.submit(() -> eventService.processOddForUpcomingEvent(part));
                }
            } finally {
                log.info("Finished updating odds for upcoming events");
            }
        }
    }

    @GetMapping("init-parlay")
    public void initParlay() {
        var sql = """
                select *
                  from events
                  where event_date >= CONVERT_TZ(NOW(), 'SYSTEM', '+07:00')
                    and first_hdc is not null
                    and last_hdc is not null
                    and first_ou is not null
                    and last_ou is not null
                    and first_corner is not null
                    and last_corner is not null
                """;
        var events = jdbcTemplate.query(sql, BeanPropertyRowMapper.newInstance(RawEventAnalyst.class));
        log.info("total events to gen parlay predict: {}", events.size());
        for (var event : events) {
            var param = new MapSqlParameterSource("eid", event.getEventId());
            var sqlPredict = """
                    SELECT ea.ft_score_str,
                           COUNT(1) AS score_count
                    FROM event_analyst ea
                    where true
                      AND first_hdc = :f_hdc
                      and last_hdc = :l_hdc
                      and first_ou = :f_ou
                      and last_ou = :l_ou
                      and first_corner = :f_corner
                      and last_corner = :l_corner
                    GROUP BY ea.ft_score_str
                    ORDER BY score_count DESC
                    LIMIT 3
                    """;

            var listGoalPredict = jdbcTemplate.query(sqlPredict,
                    Map.of(
                            "f_hdc", event.getFirstHdc(),
                            "l_hdc", event.getLastHdc(),
                            "f_ou", event.getFirstOu(),
                            "l_ou", event.getLastOu(),
                            "f_corner", event.getFirstCorner(),
                            "l_corner", event.getLastCorner()
                    ),
                    BeanPropertyRowMapper.newInstance(ParlayPredict.class)
            );
            var top5GoalPredict = listGoalPredict.stream()
                    .sorted(Comparator.comparingInt(ParlayPredict::getScoreCount).reversed())
                    .limit(5)
                    .toList();

            var sqlTotalGoalPredict = """
                    SELECT ea.ft_total_goal,
                           COUNT(1) AS score_count
                    FROM event_analyst ea
                    where true
                      AND first_hdc = :f_hdc
                      and last_hdc = :l_hdc
                      and first_ou = :f_ou
                      and last_ou = :l_ou
                      and first_corner = :f_corner
                      and last_corner = :l_corner
                    GROUP BY ea.ft_total_goal
                    ORDER BY score_count DESC
                    LIMIT 3
                    """;

            var listTotalGoalPredict = jdbcTemplate.query(sqlTotalGoalPredict,
                    Map.of(
                            "f_hdc", event.getFirstHdc(),
                            "l_hdc", event.getLastHdc(),
                            "f_ou", event.getFirstOu(),
                            "l_ou", event.getLastOu(),
                            "f_corner", event.getFirstCorner(),
                            "l_corner", event.getLastCorner()
                    ),
                    BeanPropertyRowMapper.newInstance(ParlayPredict.class)
            );
            var top5TotalGoalPredict = listTotalGoalPredict.stream()
                    .sorted(Comparator.comparingInt(ParlayPredict::getScoreCount).reversed())
                    .limit(5)
                    .toList();


            var sqlCorner = """
                    SELECT ea.total_corner,
                           COUNT(1) AS score_count
                    FROM event_analyst ea
                    where true
                      AND first_hdc = :f_hdc
                      and last_hdc = :l_hdc
                      and first_ou = :f_ou
                      and last_ou = :l_ou
                      and first_corner = :f_corner
                      and last_corner = :l_corner
                    GROUP BY ea.total_corner
                    ORDER BY score_count DESC
                    LIMIT 3
                    """;


            AtomicInteger totalGoal = new AtomicInteger(0);
            AtomicInteger totalHome = new AtomicInteger(0);
            top5GoalPredict.forEach(e -> {
                var homeScore = Integer.parseInt(e.getFtScoreStr().split("-")[0].trim());
                var awayScore = Integer.parseInt(e.getFtScoreStr().split("-")[1].trim());

                var hdcLine = event.getLastHdc();
                var hdcHome = OddConverter.convertLine(hdcLine.split("#")[0]);
                double adjustedHome = homeScore + hdcHome;
                if (hdcLine.charAt(0) == '-') {
                    if (adjustedHome > (double) awayScore) {
                        totalHome.getAndIncrement();
                    }
                } else {
                    if (adjustedHome >= (double) awayScore) {
                        totalHome.getAndIncrement();
                    }
                }
            });

            top5TotalGoalPredict.forEach(e -> {
                var totalGoalLine = OddConverter.convertLine(event.getLastOu());
                if (e.getFtTotalGoal() > totalGoalLine) {
                    totalGoal.getAndIncrement();
                }
            });
            param
                    .addValue("goals", String.join(",", top5GoalPredict.stream().map(ParlayPredict::getFtScoreStr).toList()))
                    .addValue("total_goal", listGoalPredict.size())
                    .addValue("total_goal_over", totalGoal.get())
                    .addValue("total_home", totalHome.get());

            AtomicInteger totalCorner = new AtomicInteger(0);
            if (StringUtils.isNotBlank(event.getLastCorner())) {
                var listCornerPredict = jdbcTemplate.query(sqlCorner,
                        Map.of(
                                "f_hdc", event.getFirstHdc(),
                                "l_hdc", event.getLastHdc(),
                                "f_ou", event.getFirstOu(),
                                "l_ou", event.getLastOu(),
                                "f_corner", event.getFirstCorner(),
                                "l_corner", event.getLastCorner()
                        ),
                        BeanPropertyRowMapper.newInstance(ParlayPredict.class)
                );
                var top5CornerPredict = listCornerPredict.stream()
                        .sorted(Comparator.comparingInt(ParlayPredict::getScoreCount).reversed())
                        .limit(5)
                        .toList();
                top5CornerPredict.forEach(e -> {
                    var ouLine = OddConverter.convertLine(event.getLastCorner());
                    if (e.getTotalCorner() > ouLine) {
                        totalCorner.getAndIncrement();
                    }
                });

                param.addValue("corners", String.join(",", top5CornerPredict.stream().map(ParlayPredict::getCornerStr).toList()))
                        .addValue("total_corners", listCornerPredict.size())
                        .addValue("total_corner_over", totalCorner.get());
            } else {
                param.addValue("corners", "-")
                        .addValue("total_corners", 0)
                        .addValue("total_corner_over", 0);
            }

            var sqlParlayPredict = """
                    insert into parlay_predict(event_id
                    , scores
                    , total_result_score
                    , total_result_over
                    , total_result_home
                    , corners
                    , total_result_corner
                    , total_corner_over)
                    VALUES (:eid
                    , :goals
                    , :total_goal
                    , :total_goal_over
                    , :total_home
                    , :corners
                    , :total_corners
                    , :total_corner_over)
                    ON DUPLICATE KEY UPDATE scores              = values(scores)
                                          , total_result_score  = values(total_result_score)
                                          , total_result_over   = values(total_result_over)
                                          , total_result_home   = values(total_result_home)
                                          , corners             = values(corners)
                                          , total_result_corner = values(total_result_corner)
                                          , total_corner_over   = values(total_corner_over)
                    """;
            jdbcTemplate.update(sqlParlayPredict, param);
        }
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

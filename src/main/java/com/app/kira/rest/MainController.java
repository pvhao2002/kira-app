package com.app.kira.rest;

import com.app.kira.model.EventDTO;
import com.app.kira.model.EventResult;
import com.app.kira.model.OddGoal;
import com.app.kira.util.DateUtil;
import com.google.gson.Gson;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Log
@RestController
@RequiredArgsConstructor
public class MainController {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final Gson gson = new Gson();
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

    private final String PROMPT = """
            I will provide a list of upcoming football matches below.
            For each match, please predict the result and provide betting recommendations for the following markets:
            – Asian Handicap
            – 1X2 (European odds)
            – Over/Under Goals
            – Over/Under Corners
            – Over/Under Cards
                        
            Base your analysis on current form, head-to-head record, team news, and tactical trends. If detailed data is not available, use probability and general patterns.
                        
            Matches:
                        
            %s
            …
                        
            For each match, please present your answer in this format:
                        
            Score prediction:
                        
            Asian Handicap pick:
                        
            1X2 pick:
                        
            Over/Under Goals pick:
                        
            Over/Under Corners pick:
                        
            Over/Under Cards pick:
                        
            Reasoning:
            """;

    @GetMapping(value = "under", produces = MediaType.TEXT_PLAIN_VALUE)
    public Object under(@RequestParam(required = false, defaultValue = "1") String mode) {
        var events = getEvents("");
        return events.stream()
                .filter(it -> List.of("2.25", "2/2.5").contains(Optional.ofNullable(it.getOddsGoal())
                        .filter(odds -> !odds.isEmpty())
                        .map(List::getFirst)
                        .map(OddGoal::getGoals)
                        .orElse("null")))
                .collect(Collectors.collectingAndThen(
                        Collectors.toList(),
                        list -> "Tổng số event: " + list.size() + "\n" +
                                list.stream()
                                        .map(it -> "1".equalsIgnoreCase(mode) ? it.toResultUnder() : it.toResult(true))
                                        .collect(Collectors.joining("\n"))
                ));
    }

    @GetMapping(value = "current", produces = MediaType.TEXT_PLAIN_VALUE)
    public Object current(
            @RequestParam(value = "league_name", defaultValue = "") String leagueName,
            @RequestParam(value = "showOdd", required = false) Boolean showOdd
    ) {
        return getEvents(leagueName)
                .stream()
                .collect(Collectors.collectingAndThen(
                        Collectors.toList(),
                        list -> "Tổng số event: " + list.size() + "\n" +
                                list.stream()
                                        .map(it -> it.toResult(true))
                                        .collect(Collectors.joining("\n"))
                ));
    }

    @GetMapping(value = "new-predict", produces = MediaType.TEXT_PLAIN_VALUE)
    public Object newPredict(
            @RequestParam(value = "league_name", defaultValue = "") String leagueName
    ) {
        return getEvents(leagueName)
                .stream()
                .collect(Collectors.collectingAndThen(
                        Collectors.toList(),
                        list -> "Tổng số event: " + list.size() + "\n" +
                                PROMPT.formatted(
                                        IntStream.range(0, list.size())
                                                .mapToObj(i -> list.get(i).toResult(i + 1))
                                                .collect(Collectors.joining("\n"))
                                ) + "\n\n"
                ));
    }

    private List<EventResult> getEvents(String leagueName) {
        var sql = """
                SELECT e.event_id,
                       e.event_name,
                       e.event_date,
                       e.league_name,
                       o.odd_type,
                       o.odd_value
                FROM events e
                         LEFT JOIN odds o ON e.event_id = o.event_id
                WHERE e.event_date BETWEEN :start_date AND :end_date
                   AND e.league_name LIKE :league_name
                ORDER BY e.event_date
                """;
        var startDate = DateUtil.currentDateNow();
        var endDate = DateUtil.next7Days();
        var param = new MapSqlParameterSource()
                .addValue("start_date", startDate)
                .addValue("end_date", endDate)
                .addValue("league_name", "%" + leagueName + "%");
        return jdbcTemplate.query(sql, param, (rs, i) -> new EventDTO(rs))
                .stream()
                .collect(Collectors.groupingBy(EventDTO::getEventId))
                .entrySet()
                .stream()
                .map(EventResult::new)
                .sorted(Comparator.comparing(EventResult::getEventDate))
                .toList();
    }

    @GetMapping("league")
    public Object getLeagues(@RequestParam(value = "day", defaultValue = "today") String day) {
        var sql = """
                select league_name, MIN(event_date) AS event_date
                from events
                WHERE event_date BETWEEN
                          CASE
                              WHEN :day = 'today' THEN CONCAT('2025-06-05', ' 00:00:00')
                              WHEN :day = 'tomorrow' THEN CONCAT(DATE_ADD('2025-06-05', INTERVAL 1 DAY), ' 00:00:00')
                              END
                          AND
                          CASE
                              WHEN :day = 'today' THEN CONCAT('2025-06-05', ' 23:59:59')
                              WHEN :day = 'tomorrow' THEN CONCAT(DATE_ADD('2025-06-05', INTERVAL 1 DAY), ' 23:59:59')
                              END
                GROUP BY league_name
                HAVING event_date > DATE_ADD(NOW(), INTERVAL 7 HOUR)
                ORDER BY event_date
                """;
        var param = new MapSqlParameterSource()
                .addValue("day", day);
        return jdbcTemplate.query(
                sql,
                param,
                (rs, i) -> new String[]{rs.getString("league_name"), rs.getString("event_date")}
        );
    }
}

package com.app.kira.rest;

import com.app.kira.dto.*;
import com.app.kira.model.FilterOdd;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/events")
@RequiredArgsConstructor
public class EventController {
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @PostMapping("filter-odd")
    public Object filterOdd(@RequestBody List<FilterOdd> request) {
        var sql = """
                select ea.event_id
                     , home_team
                     , away_team
                     , ea.league_name
                     , event_date
                     , ht_score_str
                     , ft_score_str
                     , corner_str
                     , link
                
                     , first_home_odds
                     , last_home_odds
                     , first_away_odds
                     , last_away_odds
                     , first_over_odds
                     , last_over_odds
                     , first_under_odds
                     , last_under_odds
                
                     , first_hdc
                     , last_hdc
                     , first_ou
                     , last_ou
                
                from event_analyst ea
                         left join kira_league kl on kl.league_id = ea.league_id
                where true
                      and ea.first_ou = :f_ou_line
                      and ea.last_ou = :l_ou_line
                      and ea.first_hdc = :f_hdc_line
                      and ea.last_hdc = :l_hdc_line
                
                order by kl.is_main desc
                       , ea.event_date desc
                       , ea.event_name
                """;
        var param = new MapSqlParameterSource();
        for (var r : request) {
            if ("ou".equalsIgnoreCase(r.getType())) {
                param.addValue("f_ou_line", r.getFirstLine());
                param.addValue("l_ou_line", r.getLastLine());
            } else {
                param.addValue("f_hdc_line", r.getFirstLine());
                param.addValue("l_hdc_line", r.getLastLine());
            }
        }
        var data = namedParameterJdbcTemplate.query(sql, param, BeanPropertyRowMapper.newInstance(RawEventAnalyst.class))
                .stream()
                .map(EventFilterAnalystDTO::new)
                .toList();

        var scoreGroup = data.stream()
                .collect(Collectors.groupingBy(EventFilterAnalystDTO::getFtScoreStr))
                .entrySet()
                .stream()
                .map(ScoreSummary::new)
                .sorted(Comparator.comparing(ScoreSummary::getCnt).reversed())
                .toList();

        return Map.of(
                "data", data
                , "summary", new SummaryOddEventAnalyst(data, request)
                , "scoreSummary", scoreGroup
        );
    }

    @GetMapping
    public Object findAll(
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "key", defaultValue = "") String key,
            @RequestParam(name = "isTeam", defaultValue = "false") Boolean isTeam,
            @RequestParam(name = "exact", defaultValue = "false") Boolean exact
    ) {
        var offset = (page - 1) * size;
        var param = new MapSqlParameterSource()
                .addValue("key", exact ? key : "%" + key + "%")
                .addValue("exact", exact)
                .addValue("isTeam", isTeam)
                .addValue("offset", offset)
                .addValue("size", size);

        var sql = """
                select ea.event_id
                     , kl.league_name
                     , home_team
                     , away_team
                     , event_date
                     , ht_score_str as ht_score
                     , ft_score_str as ft_score
                     , corner_str   as corner_score
                     , is_main      AS is_main_league
                     , link
                      , ft_home_score
                      , ht_home_score
                      , home_corner
                      , ft_away_score
                      , ht_away_score
                      , away_corner
                      , JSON_OBJECT(
                        'hdc', JSON_OBJECT(
                                'line', IFNULL(ea.last_hdc, ''),
                                'homeOdds', IFNULL(ea.last_home_odds, ''),
                                'awayOdds', IFNULL(ea.last_away_odds, '')
                               ),
                        'ou', JSON_OBJECT(
                                'line', IFNULL(ea.last_ou, ''),
                                'overOdds', IFNULL(ea.last_over_odds, ''),
                                'underOdds', IFNULL(ea.last_under_odds, '')
                              ))    AS odd_info
                from event_analyst ea
                         left join kira_league kl on kl.league_id = ea.league_id
                where TRUE
                  AND (
                    :key = ''
                    OR (
                        (:exact = TRUE AND (
                            (:isTeam = TRUE AND (ea.home_team = :key OR ea.away_team = :key))
                            OR
                            (:isTeam = FALSE AND (ea.league_name = :key OR ea.home_team = :key OR ea.away_team = :key))
                        ))
                        OR
                        (:exact = FALSE AND (
                            (:isTeam = TRUE AND (ea.home_team LIKE :key OR ea.away_team LIKE :key))
                            OR
                            (:isTeam = FALSE AND (ea.league_name LIKE :key OR ea.home_team LIKE :key OR ea.away_team LIKE :key))
                        ))
                    )
                )
                order by kl.is_main desc, event_date desc
                limit :size offset :offset
                """;
        var result = namedParameterJdbcTemplate.query(sql, param, (rs, i) -> new EventDTO(rs));
        var countSql = """
                select count(1)
                from event_analyst ea
                         left join kira_league kl on kl.league_id = ea.league_id
                where TRUE
                  AND (
                    :key = ''
                    OR (
                        (:exact = TRUE AND (
                            (:isTeam = TRUE AND (ea.home_team = :key OR ea.away_team = :key))
                            OR
                            (:isTeam = FALSE AND (ea.league_name = :key OR ea.home_team = :key OR ea.away_team = :key))
                        ))
                        OR
                        (:exact = FALSE AND (
                            (:isTeam = TRUE AND (ea.home_team LIKE :key OR ea.away_team LIKE :key))
                            OR
                            (:isTeam = FALSE AND (ea.league_name LIKE :key OR ea.home_team LIKE :key OR ea.away_team LIKE :key))
                        ))
                    )
                )
                """;
        var count = namedParameterJdbcTemplate.queryForObject(countSql, param, Integer.class);
        TeamAnalystDetailDTO detail = new TeamAnalystDetailDTO();
        if (isTeam && exact) {
            var ftScore = result.stream()
                    .map(e -> StringUtils.compare(e.getHomeTeam(), key) == 0
                            ? e.getFtHomeScore()
                            : e.getFtAwayScore())
                    .toList();
            var htScore = result.stream()
                    .map(e -> StringUtils.compare(e.getHomeTeam(), key) == 0
                            ? e.getHtHomeScore()
                            : e.getHtAwayScore())
                    .toList();
            var corner = result.stream()
                    .map(e -> StringUtils.compare(e.getHomeTeam(), key) == 0
                            ? e.getHomeCorner()
                            : e.getAwayCorner())
                    .toList();
            var minFtScore = ftScore.stream().filter(e -> e != 0).min(Integer::compareTo).orElse(0);
            var maxFtScore = ftScore.stream().max(Integer::compareTo).orElse(0);
            var avgFtScore = ftScore.stream().mapToInt(Integer::intValue).average().orElse(0.0);
            detail.setMinFtScore(minFtScore);
            detail.setMaxFtScore(maxFtScore);
            detail.setAvgFtScore(avgFtScore);

            var minHtScore = htScore.stream().filter(e -> e != 0).min(Integer::compareTo).orElse(0);
            var maxHtScore = htScore.stream().max(Integer::compareTo).orElse(0);
            var avgHtScore = htScore.stream().mapToInt(Integer::intValue).average().orElse(0.0);
            detail.setMinHtScore(minHtScore);
            detail.setMaxHtScore(maxHtScore);
            detail.setAvgHtScore(avgHtScore);

            var minCorner = corner.stream().filter(e -> e != 0).min(Integer::compareTo).orElse(0);
            var maxCorner = corner.stream().max(Integer::compareTo).orElse(0);
            var avgCorner = corner.stream().mapToInt(Integer::intValue).average().orElse(0.0);
            detail.setMinCorner(minCorner);
            detail.setMaxCorner(maxCorner);
            detail.setAvgCorner(avgCorner);
        }
        return Map.of(
                "data", result,
                "page", page,
                "size", size,
                "total", count,
                "isTeam", isTeam,
                "exact", exact,
                "detail", detail
        );
    }
}

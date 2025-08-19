package com.app.kira.schedule;

import com.app.kira.dto.RawEventAnalyst;
import com.app.kira.dto.predict.PredictDTO;
import com.app.kira.dto.predict.PredictDetail;
import com.app.kira.dto.predict.PredictStats;
import com.app.kira.util.OddConverter;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.apache.commons.lang3.StringUtils;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.text.MessageFormat;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Log
@Service
@RequiredArgsConstructor
public class PredictSchedule {
    private static final String MINUS = "-";
    private static final String HASH = "#";
    private static final String COMMA = ",";
    private static final String SQL_PREDICT_SIMPLE = """
            SELECT ft_score_str, score_count
            FROM (SELECT ea.ft_score_str,
                         COUNT(1)              AS score_count,
                         MAX(COUNT(1)) OVER () AS max_score
                  FROM event_analyst ea
                  WHERE TRUE
                    AND ea.first_hdc = :first_hdc
                    AND ea.last_hdc = :last_hdc
                    AND ea.first_ou = :first_ou
                    AND ea.last_ou = :last_ou
                    %s
                  GROUP BY ea.ft_score_str) t
            WHERE score_count = max_score
            """;

    private static final String SQL_CONDITION_SIMPLE = """
            AND ea.first_home_odds = :first_home_odds
            AND ea.first_over_odds = :first_over_odds
            AND ea.last_home_odds = :last_home_odds
            AND ea.last_over_odds = :last_over_odds
            """;

    private static final String SQL_GET_EVENT_PREDICT = """
                select e.event_id,
                     e.event_name,
                     e.event_date,
                     e.first_hdc,
                     e.first_home_odds,
                     e.first_away_odds,
                     e.last_hdc,
                     e.last_home_odds,
                     e.last_away_odds,
                     e.first_ou,
                     e.first_over_odds,
                     e.first_under_odds,
                     e.last_ou,
                     e.last_over_odds,
                     e.last_under_odds,
                     p.predict_id
              from events e
                       inner join predict p on p.event_name = e.event_name and p.event_date = e.event_date
              WHERE TRUE
                AND e.event_date > CONVERT_TZ(NOW(), '+00:00', '+07:00')
                AND e.first_hdc IS NOT NULL
                AND e.first_ou IS NOT NULL
            """;
    private static final String SQL_PREDICT_STATS = """
            select COUNT(1)                                          AS total_count,
                   SUM(IF(first_home_odds < first_away_odds, 1, 0))  AS first_home_less_away,
                   SUM(IF(first_home_odds > first_away_odds, 1, 0))  AS first_home_greater_away,
                   SUM(IF(first_home_odds = first_away_odds, 1, 0))  AS first_home_equal_away,
                   SUM(IF(last_home_odds < last_away_odds, 1, 0))    AS last_home_less_away,
                   SUM(IF(last_home_odds > last_away_odds, 1, 0))    AS last_home_greater_away,
                   SUM(IF(last_home_odds = last_away_odds, 1, 0))    AS last_home_equal_away,
            
                   SUM(IF(first_over_odds < first_under_odds, 1, 0)) AS first_over_less_under,
                   SUM(IF(first_over_odds > first_under_odds, 1, 0)) AS first_over_greater_under,
                   SUM(IF(first_over_odds = first_under_odds, 1, 0)) AS first_over_equal_under,
                   SUM(IF(last_over_odds < last_under_odds, 1, 0))   AS last_over_less_under,
                   SUM(IF(last_over_odds > last_under_odds, 1, 0))   AS last_over_greater_under,
                   SUM(IF(last_over_odds = last_under_odds, 1, 0))   AS last_over_equal_under
            from event_analyst
            where true
              and first_hdc= :first_hdc
              and last_hdc = :last_hdc
              and first_ou = :first_ou
              and last_ou = :last_ou
            """;
    private static final String SQL_INSERT_PREDICT_DETAIL = """
            insert into predict_detail(predict_type, predict_id, predict_score, hdc_pick, ou_pick, hdc_count, ou_count, match_count)
            values (:predict_type, :predict_id, :predict_score, :hdc_pick, :ou_pick, :hdc_count, :ou_count, :match_count)
            on duplicate key update predict_score = values(predict_score)
                                  , hdc_pick      = values(hdc_pick)
                                  , ou_pick       = values(ou_pick)
            
                                  , hdc_count     = values(hdc_count)
                                  , ou_count      = values(ou_count)
                                  , match_count   = values(match_count)
            """;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Scheduled(fixedDelay = 15, initialDelay = 5, timeUnit = TimeUnit.MINUTES)
    public void predict() {
        var eventToPredict = jdbcTemplate.query(SQL_GET_EVENT_PREDICT, BeanPropertyRowMapper.newInstance(RawEventAnalyst.class));
        log.log(java.util.logging.Level.INFO, "Predicting for {0} events", eventToPredict.size());
        if (CollectionUtils.isEmpty(eventToPredict)) {
            return;
        }
        eventToPredict.forEach(event -> {
            log.log(Level.INFO, "Predicting for event: {0} - {1}", new Object[]{event.getEventId(), event.getEventName()});
            log.log(Level.INFO, "Predict simple");
            var simpleDetail = predictSimple(event);
            log.log(Level.INFO, "Predict complex");
            var complexDetail = predictComplex(event);
            log.log(Level.INFO, "Predict combine");
            var combineDetail = predictCombine(simpleDetail, complexDetail, event);
            var predictParam = Stream.of(simpleDetail, complexDetail, combineDetail).map(PredictDetail::toParam).toArray(MapSqlParameterSource[]::new);
            jdbcTemplate.batchUpdate(SQL_INSERT_PREDICT_DETAIL, predictParam);
            log.log(Level.INFO, "Saving predict details");
        });
        log.log(java.util.logging.Level.INFO, "Predict done for {0} events", eventToPredict.size());
    }

    private PredictDetail predictCombine(PredictDetail simple, PredictDetail complex, RawEventAnalyst event) {
        var detail = new PredictDetail();
        detail.setPredictType(PredictDetail.PredictType.COMBINE);
        detail.setPredictId(event.getPredictId());
        var ouCounter = new EnumMap<PredictDetail.PredictPick, Integer>(PredictDetail.PredictPick.class);
        var hdcCounter = new EnumMap<PredictDetail.PredictPick, Integer>(PredictDetail.PredictPick.class);
        var scoreCounter = new HashMap<String, Integer>();
        if (simple.getOuPick() != PredictDetail.PredictPick.NONE) {
            ouCounter.merge(simple.getOuPick(), 1, Integer::sum);
        }
        if (simple.getHdcPick() != PredictDetail.PredictPick.NONE) {
            hdcCounter.merge(simple.getHdcPick(), 1, Integer::sum);
        }
        if (StringUtils.isNotBlank(simple.getPredictScore())) {
            for (var s : simple.getPredictScore().split(COMMA)) {
                scoreCounter.merge(s.trim(), 1, Integer::sum);
            }
        }

        if (StringUtils.isNotBlank(complex.getPredictScore())) {
            for (var s : complex.getPredictScore().split(COMMA)) {
                scoreCounter.merge(s.trim(), 1, Integer::sum);
            }
        }
        scoreCounter.entrySet().stream()
                .sorted((e1, e2) -> {
                    int cmp = Integer.compare(e2.getValue(), e1.getValue()); // desc by count
                    if (cmp == 0) {
                        return e1.getKey().compareTo(e2.getKey()); // tie-break bằng string order
                    }
                    return cmp;
                })
                .map(Map.Entry::getKey)
                .findFirst()
                .ifPresent(ftScore -> {
                    var e = new PredictDTO(ftScore, 0);
                    predict(e, detail, hdcCounter, ouCounter, event);
                });
        setFinalPick(detail, hdcCounter, ouCounter);
        limit5Scores(detail);
        return detail;
    }

    private PredictDetail predictComplex(RawEventAnalyst event) {
        var detail = new PredictDetail();
        detail.setPredictType(PredictDetail.PredictType.COMPLEX);
        detail.setPredictId(event.getPredictId());
        var param = event.toParam();
        var ouCounter = new EnumMap<PredictDetail.PredictPick, Integer>(PredictDetail.PredictPick.class);
        var hdcCounter = new EnumMap<PredictDetail.PredictPick, Integer>(PredictDetail.PredictPick.class);
        jdbcTemplate.query(SQL_PREDICT_STATS, param, BeanPropertyRowMapper.newInstance(PredictStats.class))
                .stream().findFirst()
                .ifPresent(s -> {
                    var sqlBaseOdd = buildSqlComplexBaseOddUpcomingEvent(event);
                    jdbcTemplate.query(sqlBaseOdd, param, BeanPropertyRowMapper.newInstance(PredictDTO.class))
                            .forEach(e -> predict(e, detail, hdcCounter, ouCounter, event));

                    var sqlBaseMinStats = buildSqlComplexBaseMinStats(s);
                    jdbcTemplate.query(sqlBaseMinStats, param, BeanPropertyRowMapper.newInstance(PredictDTO.class))
                            .forEach(e -> predict(e, detail, hdcCounter, ouCounter, event));

                    var sqlBaseMaxStats = buildSqlComplexBaseMaxStats(s);
                    jdbcTemplate.query(sqlBaseMaxStats, param, BeanPropertyRowMapper.newInstance(PredictDTO.class))
                            .forEach(e -> predict(e, detail, hdcCounter, ouCounter, event));
                });
        setFinalPick(detail, hdcCounter, ouCounter);
        limit5Scores(detail);
        return detail;
    }

    private void predict(
            PredictDTO e
            , PredictDetail detail
            , EnumMap<PredictDetail.PredictPick, Integer> hdcCounter
            , EnumMap<PredictDetail.PredictPick, Integer> ouCounter
            , RawEventAnalyst event
    ) {
        var homeScore = Integer.parseInt(e.getFtScoreStr().split(MINUS)[0].trim());
        var awayScore = Integer.parseInt(e.getFtScoreStr().split(MINUS)[1].trim());
        var totalScore = (double) homeScore + awayScore;
        detail.setPredictScore(StringUtils.isBlank(detail.getPredictScore())
                ? e.getFtScoreStr()
                : detail.getPredictScore() + COMMA + e.getFtScoreStr());

        var ouLine = OddConverter.convertLine(event.getLastOu());
        var ouPick = totalScore > ouLine
                ? PredictDetail.PredictPick.OVER
                : PredictDetail.PredictPick.UNDER;
        ouCounter.merge(ouPick, 1, Integer::sum);

        var hdcLine = event.getLastHdc();
        var hdcHome = OddConverter.convertLine(hdcLine.split(HASH)[0]);
        var hdcAway = OddConverter.convertLine(hdcLine.split(HASH)[1]);
        double adjustedHome = homeScore + hdcHome;
        double adjustedAway = awayScore + hdcAway;
        var hdcPick = adjustedHome > adjustedAway
                ? PredictDetail.PredictPick.HOME
                : PredictDetail.PredictPick.AWAY;
        hdcCounter.merge(hdcPick, 1, Integer::sum);
        detail.setMatchCount(Math.max(Optional.ofNullable(detail.getMatchCount()).orElse(0), e.getScoreCount()));
    }

    private String buildSqlComplexBaseMinStats(PredictStats stats) {
        var sql = SQL_PREDICT_SIMPLE.formatted("""
                and ({0} and {1})
                """);
        return MessageFormat.format(
                sql,
                stats.getMinHdc(),
                stats.getMinOu()
        );
    }

    private String buildSqlComplexBaseMaxStats(PredictStats stats) {
        var sql = SQL_PREDICT_SIMPLE.formatted("""
                and ({0} and {1})
                """);
        return MessageFormat.format(
                sql,
                stats.getMaxHdc(),
                stats.getMaxOu()
        );
    }

    private String buildSqlComplexBaseOddUpcomingEvent(RawEventAnalyst event) {
        var sql = SQL_PREDICT_SIMPLE.formatted("""
                  and ((first_home_odds {0} first_away_odds and first_over_odds {1} first_under_odds)
                    or -- based on big small odd handicap and over under odd
                       (last_home_odds {2} last_away_odds and last_over_odds {3} last_under_odds))
                """);
        return MessageFormat.format(
                sql,
                OddConverter.compareOdds(event.getFirstHomeOdds(), event.getFirstAwayOdds()),
                OddConverter.compareOdds(event.getFirstOverOdds(), event.getFirstUnderOdds()),
                OddConverter.compareOdds(event.getLastHomeOdds(), event.getLastAwayOdds()),
                OddConverter.compareOdds(event.getLastOverOdds(), event.getLastUnderOdds())
        );
    }

    private PredictDetail predictSimple(RawEventAnalyst event) {
        var detail = new PredictDetail();
        detail.setPredictType(PredictDetail.PredictType.SIMPLE);
        detail.setPredictId(event.getPredictId());
        var param = event.toParam();
        var result1 = jdbcTemplate.query(SQL_PREDICT_SIMPLE.formatted(""), param, BeanPropertyRowMapper.newInstance(PredictDTO.class));
        var result2 = jdbcTemplate.query(SQL_PREDICT_SIMPLE.formatted(SQL_CONDITION_SIMPLE), param, BeanPropertyRowMapper.newInstance(PredictDTO.class));
        var ouCounter = new EnumMap<PredictDetail.PredictPick, Integer>(PredictDetail.PredictPick.class);
        var hdcCounter = new EnumMap<PredictDetail.PredictPick, Integer>(PredictDetail.PredictPick.class);
        var merged = Stream.concat(result1.stream(), result2.stream())
                .collect(Collectors.toMap(
                        PredictDTO::getFtScoreStr,
                        PredictDTO::getScoreCount,
                        Integer::sum
                ))
                .entrySet()
                .stream()
                .map(e -> new PredictDTO(e.getKey(), e.getValue()))
                .toList();
        int maxCount = merged.stream()
                .mapToInt(PredictDTO::getScoreCount)
                .max()
                .orElse(0);
        merged.stream()
                .filter(dto -> dto.getScoreCount() == maxCount)
                .forEach(e -> predict(e, detail, hdcCounter, ouCounter, event));
        setFinalPick(detail, hdcCounter, ouCounter);
        // limit to 5 scores
        limit5Scores(detail);
        return detail;
    }

    private void limit5Scores(PredictDetail detail) {
        if (StringUtils.isNotBlank(detail.getPredictScore())) {
            var scores = detail.getPredictScore().split(COMMA);
            if (scores.length > 5) {
                detail.setPredictScore(Stream.of(scores).limit(5).collect(Collectors.joining(COMMA)));
            }
        }
    }

    private void setFinalPick(
            PredictDetail detail
            , EnumMap<PredictDetail.PredictPick, Integer> hdcCounter
            , EnumMap<PredictDetail.PredictPick, Integer> ouCounter
    ) {
        var finalOuPick = ouCounter.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(PredictDetail.PredictPick.NONE);
        var finalHdcPick = hdcCounter.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(PredictDetail.PredictPick.NONE);
        detail.setOuPick(finalOuPick);
        detail.setHdcPick(finalHdcPick);
        detail.setOuCount(ouCounter.getOrDefault(finalOuPick, 0));
        detail.setHdcCount(hdcCounter.getOrDefault(finalHdcPick, 0));
    }
}

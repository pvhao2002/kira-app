package com.app.kira.dto.predict;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.AbstractMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictStats {
    private static final String FIRST_HOME_LESS_AWAY = "firstHomeLessAway";
    private static final String FIRST_HOME_GREATER_AWAY = "firstHomeGreaterAway";
    private static final String LAST_HOME_LESS_AWAY = "lastHomeLessAway";
    private static final String LAST_HOME_GREATER_AWAY = "lastHomeGreaterAway";
    private static final String FIRST_OVER_LESS_UNDER = "firstOverLessUnder";
    private static final String FIRST_OVER_GREATER_UNDER = "firstOverGreaterUnder";
    private static final String LAST_OVER_LESS_UNDER = "lastOverLessUnder";
    private static final String LAST_OVER_GREATER_UNDER = "lastOverGreaterUnder";
    private static final String TRUE_STR = "true";
    private static final Map<String, String> SQL = Map.of(
            FIRST_HOME_LESS_AWAY, "first_home_odds < first_away_odds",
            FIRST_HOME_GREATER_AWAY, "first_home_odds > first_away_odds",
            LAST_HOME_LESS_AWAY, "last_home_odds < last_away_odds",
            LAST_HOME_GREATER_AWAY, "last_home_odds > last_away_odds",
            FIRST_OVER_LESS_UNDER, "first_over_odds < first_under_odds",
            FIRST_OVER_GREATER_UNDER, "first_over_odds > first_under_odds",
            LAST_OVER_LESS_UNDER, "last_over_odds < last_under_odds",
            LAST_OVER_GREATER_UNDER, "last_over_odds > last_under_odds"
    );
    private Long totalCount;

    private Long firstHomeLessAway;
    private Long firstHomeGreaterAway;
    private Long firstHomeEqualAway;

    private Long lastHomeLessAway;
    private Long lastHomeGreaterAway;
    private Long lastHomeEqualAway;

    private Long firstOverLessUnder;
    private Long firstOverGreaterUnder;
    private Long firstOverEqualUnder;

    private Long lastOverLessUnder;
    private Long lastOverGreaterUnder;
    private Long lastOverEqualUnder;

    public String getMaxHdc() {
        return getBestSql(
                entry(FIRST_HOME_LESS_AWAY, firstHomeLessAway),
                entry(FIRST_HOME_GREATER_AWAY, firstHomeGreaterAway),
                entry(LAST_HOME_LESS_AWAY, lastHomeLessAway),
                entry(LAST_HOME_GREATER_AWAY, lastHomeGreaterAway)
        ).orElse(TRUE_STR);
    }

    public String getMinHdc() {
        return getWorstSql(
                entry(FIRST_HOME_LESS_AWAY, firstHomeLessAway),
                entry(FIRST_HOME_GREATER_AWAY, firstHomeGreaterAway),
                entry(LAST_HOME_LESS_AWAY, lastHomeLessAway),
                entry(LAST_HOME_GREATER_AWAY, lastHomeGreaterAway)
        ).orElse(TRUE_STR);
    }

    public String getMaxOu() {
        return getBestSql(
                entry(FIRST_OVER_LESS_UNDER, firstOverLessUnder),
                entry(FIRST_OVER_GREATER_UNDER, firstOverGreaterUnder),
                entry(LAST_OVER_LESS_UNDER, lastOverLessUnder),
                entry(LAST_OVER_GREATER_UNDER, lastOverGreaterUnder)
        ).orElse(TRUE_STR);
    }

    public String getMinOu() {
        return getWorstSql(
                entry(FIRST_OVER_LESS_UNDER, firstOverLessUnder),
                entry(FIRST_OVER_GREATER_UNDER, firstOverGreaterUnder),
                entry(LAST_OVER_LESS_UNDER, lastOverLessUnder),
                entry(LAST_OVER_GREATER_UNDER, lastOverGreaterUnder)
        ).orElse(TRUE_STR);
    }

    // ================= Helper =================
    @SafeVarargs
    private Optional<String> getBestSql(Map.Entry<String, Long>... entries) {
        return Stream.of(entries)
                .max(Map.Entry.comparingByValue())
                .map(e -> SQL.get(e.getKey()));
    }

    @SafeVarargs
    private Optional<String> getWorstSql(Map.Entry<String, Long>... entries) {
        return Stream.of(entries)
                .min(Map.Entry.comparingByValue())
                .map(e -> SQL.get(e.getKey()));
    }

    private Map.Entry<String, Long> entry(String key, Long value) {
        return new AbstractMap.SimpleEntry<>(key, Optional.ofNullable(value).orElse(0L));
    }
}

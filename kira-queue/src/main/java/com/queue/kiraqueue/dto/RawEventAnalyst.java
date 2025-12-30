package com.queue.kiraqueue.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@EqualsAndHashCode(callSuper = true)
public class RawEventAnalyst extends BaseEventAnalystDTO {
    String oddTypeHdc;
    String lineHdc;
    String homeLineHdc;
    String awayLineHdc;
    Double homeOddsHdc;
    Double awayOddsHdc;
    String homeLineMovement;
    String awayLineMovement;

    String oddTypeOu;
    String lineOu;
    Double overOu;
    Double underOu;
    String overLineMovement;
    String underLineMovement;

    String oddTypeCorner;
    String lineCorner;
    Double overCorner;
    Double underCorner;

    Double firstHomeOdds;
    Double lastHomeOdds;
    Double firstAwayOdds;
    Double lastAwayOdds;
    Double firstOverOdds;
    Double lastOverOdds;
    Double firstUnderOdds;
    Double lastUnderOdds;
    Double firstOverCornerOdds;
    Double firstUnderCornerOdds;
    Double lastOverCornerOdds;
    Double lastUnderCornerOdds;

    String firstHdc;
    String lastHdc;
    String firstOu;
    String lastOu;
    String firstCorner;
    String lastCorner;
    Long predictId;

    String homeLogo;
    String awayLogo;

    public MapSqlParameterSource toParam() {
        MapSqlParameterSource param = new MapSqlParameterSource();
        param.addValue("first_home_odds", getFirstHomeOdds());
        param.addValue("first_away_odds", getFirstAwayOdds());
        param.addValue("last_home_odds", getLastHomeOdds());
        param.addValue("last_away_odds", getLastAwayOdds());

        param.addValue("first_over_odds", getFirstOverOdds());
        param.addValue("first_under_odds", getFirstUnderOdds());
        param.addValue("last_over_odds", getLastOverOdds());
        param.addValue("last_under_odds", getLastUnderOdds());

        param.addValue("first_hdc", getFirstHdc());
        param.addValue("last_hdc", getLastHdc());

        param.addValue("first_ou", getFirstOu());
        param.addValue("last_ou", getLastOu());
        return param;
    }
}

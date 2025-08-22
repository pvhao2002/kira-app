package com.app.kira.model;

import com.app.kira.model.analyst.OddAnalyst;
import com.app.kira.util.DateUtil;
import com.app.kira.util.OddConverter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Bet {
    private String eventName;
    private String leagueName;
    private String eventDate;

    @Builder.Default
    private List<Odd1x2> odds1x2 = new ArrayList<>();

    @Builder.Default
    private List<OddGoal> oddsGoal = new ArrayList<>();

    @Builder.Default
    private List<OddHandicap> oddsHandicap = new ArrayList<>();

    @Builder.Default
    private List<OddCorner> oddsCorner = new ArrayList<>();

    public void cleanOdd() {
        this.odds1x2 = this.odds1x2.stream()
                .filter(odd -> StringUtils.isNotBlank(odd.get_1())
                        && StringUtils.isNotBlank(odd.getX())
                        && StringUtils.isNotBlank(odd.get_2()))
                .toList();
        this.oddsGoal = this.oddsGoal.stream()
                .filter(odd -> StringUtils.isNotBlank(odd.getGoals())
                        && StringUtils.isNotBlank(odd.getOver())
                        && StringUtils.isNotBlank(odd.getUnder()))
                .toList();
        this.oddsHandicap = this.oddsHandicap.stream()
                .filter(odd -> StringUtils.isNotBlank(odd.getHome())
                        && StringUtils.isNotBlank(odd.getAway()))
                .toList();
        this.oddsCorner = this.oddsCorner.stream()
                .filter(odd -> StringUtils.isNotBlank(odd.getCorner())
                        && StringUtils.isNotBlank(odd.getOver())
                        && StringUtils.isNotBlank(odd.getUnder()))
                .toList();
    }

    public MapSqlParameterSource toParamPredict(Event evt) {
        var param = new MapSqlParameterSource();
        param.addValue("event_name", evt.getEventName());
        param.addValue("event_date", evt.getEventDate());
        param.addValue("league_name", evt.getLeagueName());
        param.addValue("event_link", evt.getDetailLink());

        // ----- OU (Over/Under) -----
        var oddsGoal = getOddsGoal().stream()
                .filter(odd -> DateUtil.parseOddDate(odd.getOddDate(), null) != null)
                .toList();

        // First OU
        oddsGoal.stream()
                .min(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .ifPresentOrElse(odd -> {
                    param.addValue("first_over_odds", odd.getOver());
                    param.addValue("first_under_odds", odd.getUnder());
                    param.addValue("first_ou_line", odd.getGoals());
                }, () -> {
                    param.addValue("first_over_odds", null);
                    param.addValue("first_under_odds", null);
                    param.addValue("first_ou_line", null);
                });

        // Last OU
        oddsGoal.stream()
                .max(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .ifPresentOrElse(odd -> {
                    param.addValue("last_over_odds", odd.getOver());
                    param.addValue("last_under_odds", odd.getUnder());
                    param.addValue("last_ou_line", odd.getGoals());
                }, () -> {
                    param.addValue("last_over_odds", null);
                    param.addValue("last_under_odds", null);
                    param.addValue("last_ou_line", null);
                });

        // ----- Handicap -----
        var oddsHandicap = getOddsHandicap().stream()
                .filter(odd -> DateUtil.parseOddDate(odd.getOddDate(), null) != null)
                .toList();

        // First HDC
        oddsHandicap.stream()
                .min(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .ifPresentOrElse(e -> {
                    param.addValue("first_home_odds", e.getHome().split(" ")[1]);
                    param.addValue("first_away_odds", e.getAway().split(" ")[1]);
                    param.addValue("first_hdc_line", e.getHome().split(" ")[0] + "#" + e.getAway().split(" ")[0]);
                }, () -> {
                    param.addValue("first_home_odds", null);
                    param.addValue("first_away_odds", null);
                    param.addValue("first_hdc_line", null);
                });

        // Last HDC
        oddsHandicap.stream()
                .max(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .ifPresentOrElse(e -> {
                    param.addValue("last_home_odds", e.getHome().split(" ")[1]);
                    param.addValue("last_away_odds", e.getAway().split(" ")[1]);
                    param.addValue("last_hdc_line", e.getHome().split(" ")[0] + "#" + e.getAway().split(" ")[0]);
                }, () -> {
                    param.addValue("last_home_odds", null);
                    param.addValue("last_away_odds", null);
                    param.addValue("last_hdc_line", null);
                });

        return param;
    }


    public OddAnalyst.PrematchOdd getPrematchOdd() {
        OddAnalyst.PrematchOdd result = new OddAnalyst.PrematchOdd();
        getOddsHandicap().stream()
                .filter(odd -> DateUtil.parseOddDate(odd.getOddDate(), null) != null)
                .max(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .ifPresent(e -> result.setHdcLine(e.getHome().split(" ")[0] + "#" + e.getAway().split(" ")[0]));
        getOddsGoal().stream()
                .filter(odd -> DateUtil.parseOddDate(odd.getOddDate(), null) != null)
                .max(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .ifPresent(e -> result.setOverLine(e.getGoals()));
        return result;
    }


    public MapSqlParameterSource toPram(long eventId) {
        var param = new MapSqlParameterSource("eventId", eventId);
        var oddGoal = getOddsGoal().stream()
                .filter(odd -> DateUtil.parseOddDate(odd.getOddDate(), null) != null)
                .toList();

        var oddHdc = getOddsHandicap().stream()
                .filter(odd -> DateUtil.parseOddDate(odd.getOddDate(), null) != null)
                .toList();

        OddAnalyst minOddGoal = oddGoal.stream()
                .min(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .map(e -> OddAnalyst.builder()
                        .line(e.getGoals())
                        .overOdd(OddConverter.parse(e.getOver()))
                        .underOdd(OddConverter.parse(e.getUnder()))
                        .build())
                .orElse(new OddAnalyst());
        OddAnalyst maxOddGoal = oddGoal.stream()
                .max(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .map(e -> OddAnalyst.builder()
                        .line(e.getGoals())
                        .overOdd(OddConverter.parse(e.getOver()))
                        .underOdd(OddConverter.parse(e.getUnder()))
                        .build())
                .orElse(new OddAnalyst());

        OddAnalyst minOddHandicap = oddHdc.stream()
                .min(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .map(e -> OddAnalyst.builder()
                        .line(e.getHome().split(" ")[0] + "#" + e.getAway().split(" ")[0])
                        .homeOdd(OddConverter.parse(e.getHome().split(" ")[1]))
                        .awayOdd(OddConverter.parse(e.getAway().split(" ")[1]))
                        .build())
                .orElse(new OddAnalyst());
        OddAnalyst maxOddHandicap = oddHdc.stream()
                .max(Comparator.comparing(o -> DateUtil.parseOddDate(o.getOddDate(), null)))
                .map(e -> OddAnalyst.builder()
                        .line(e.getHome().split(" ")[0] + "#" + e.getAway().split(" ")[0])
                        .homeOdd(OddConverter.parse(e.getHome().split(" ")[1]))
                        .awayOdd(OddConverter.parse(e.getAway().split(" ")[1]))
                        .build())
                .orElse(new OddAnalyst());

        param.addValue("first_home_odds", minOddHandicap.getHomeOdd());
        param.addValue("first_away_odds", minOddHandicap.getAwayOdd());
        param.addValue("last_home_odds", maxOddHandicap.getHomeOdd());
        param.addValue("last_away_odds", maxOddHandicap.getAwayOdd());

        param.addValue("first_over_odds", minOddGoal.getOverOdd());
        param.addValue("first_under_odds", minOddGoal.getUnderOdd());
        param.addValue("last_over_odds", maxOddGoal.getOverOdd());
        param.addValue("last_under_odds", maxOddGoal.getUnderOdd());

        param.addValue("first_hdc", minOddHandicap.getLine());
        param.addValue("last_hdc", maxOddHandicap.getLine());

        param.addValue("first_ou", minOddGoal.getLine());
        param.addValue("last_ou", maxOddGoal.getLine());
        return param;
    }
}

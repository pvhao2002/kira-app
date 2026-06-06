package com.queue.kiraqueue.dto;

import com.queue.kiraqueue.util.CountryCodeShortUtil;
import com.queue.kiraqueue.util.DateUtil;
import com.queue.kiraqueue.util.PlaywrightUtil;
import lombok.*;
import org.jsoup.nodes.Element;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.time.LocalDateTime;
import java.util.Optional;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@EqualsAndHashCode(of = "externalId")
public class EventHtml {
    private Integer id;
    private String externalId;
    private String eventName;
    private String homeName;
    private String awayName;
    private String homeUrl;
    private String awayUrl;
    private LocalDateTime eventDate;

    @With
    private String countryName;
    @With
    private String leagueName;
    @With
    private String leagueUrl;

    private String detailLink;

    private Integer ftHomeScore;
    private Integer ftAwayScore;
    private Integer htHomeScore;
    private Integer htAwayScore;

    private String ftScoreStr;
    private String htScoreStr;
    private String cornerStr;

    private Integer homeCorner;
    private Integer awayCorner;

    private String providerStatus;

    public EventHtml(Element ele) {
        this.externalId = ele.attr("data-id");
        this.homeName = ele.select("[itemprop=homeTeam]").text();
        this.homeUrl = PlaywrightUtil.getImageFromImgSrc(ele, ".teamBox.teamHomeBox img");
        this.providerStatus = ele.select(".status.minitext").text();
        this.awayName = ele.select("[itemprop=awayTeam]").text();
        this.awayUrl = PlaywrightUtil.getImageFromImgSrc(ele, ".teamBox.teamAwayBox img");

        this.eventName = "%s v %s".formatted(this.homeName, this.awayName);
        this.eventDate = Optional.ofNullable(ele.selectFirst("meta[itemprop=startDate]"))
                .map(e -> e.attr("content"))
                .map(DateUtil::convertToHCM)
                .orElse(null);
        this.detailLink = ele.absUrl("href");

        this.htScoreStr = ele.select(".half-over").text();
        this.ftScoreStr = ele.select(".scores.finished").text();
        this.cornerStr = ele.select(".corner.cornerBox").text();
        var minus = "-";

        var ftScoreTemp = ftScoreStr.split(minus);
        if (ftScoreTemp.length == 2) {
            this.ftHomeScore = parseScore(ftScoreTemp[0].trim());
            this.ftAwayScore = parseScore(ftScoreTemp[1].trim());
        } else {
            this.ftHomeScore = null;
            this.ftAwayScore = null;
        }

        var htScoreTemp = htScoreStr.replace("HT", "").split(minus);
        if (htScoreTemp.length == 2) {
            this.htHomeScore = parseScore(htScoreTemp[0].trim());
            this.htAwayScore = parseScore(htScoreTemp[1].trim());
        } else {
            this.htHomeScore = null;
            this.htAwayScore = null;
        }

        var cornerTemp = cornerStr.split(minus);
        if (cornerTemp.length == 2) {
            this.homeCorner = parseScore(cornerTemp[0].trim());
            this.awayCorner = parseScore(cornerTemp[1].trim());
        } else {
            this.homeCorner = null;
            this.awayCorner = null;
        }
    }

    public MapSqlParameterSource toParamInsertEventResult(Long eventId) {
        return new MapSqlParameterSource()
                .addValue("eventId", eventId)
                .addValue("htHomeGoal", htHomeScore)
                .addValue("htAwayGoal", htAwayScore)
                .addValue("ftHomeGoal", ftHomeScore)
                .addValue("ftAwayGoal", ftAwayScore)
                .addValue("ftHomeCorner", homeCorner)
                .addValue("ftAwayCorner", awayCorner)
                .addValue("htResult", getResult(htHomeScore, htAwayScore))
                .addValue("htGoalStr", htScoreStr)
                .addValue("ftResult", getResult(ftHomeScore, ftAwayScore))
                .addValue("ftGoalStr", ftScoreStr);
    }

    public MapSqlParameterSource toParamInsertEvent(Integer leagueId, Integer homeId, Integer awayId) {
        return new MapSqlParameterSource()
                .addValue("exid", this.getExternalId())
                .addValue("league_id", leagueId)
                .addValue("home_id", homeId)
                .addValue("away_id", awayId)
                .addValue("event_name", this.getEventName())
                .addValue("event_date", this.getEventDate())
                .addValue("status", this.getProviderStatus())
                .addValue("link", this.getDetailLink());
    }

    public String getResult(Integer homeScore, Integer awayScore) {
        if (homeScore == null || awayScore == null) {
            return "None";
        }
        if (homeScore > awayScore) {
            return "H";
        } else if (homeScore < awayScore) {
            return "A";
        }
        return "D";
    }

    public Integer parseScore(String score) {
        try {
            return Integer.parseInt(score.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

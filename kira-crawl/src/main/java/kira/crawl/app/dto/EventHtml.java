package kira.crawl.app.dto;

import kira.crawl.app.util.DateUtil;
import kira.crawl.app.util.PlaywrightUtil;
import lombok.*;
import org.jsoup.nodes.Element;

import java.time.LocalDateTime;
import java.util.Optional;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@EqualsAndHashCode(of = "externalId")
public class EventHtml {
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

        var ftScoreTemp = ftScoreStr.split("-");
        if (ftScoreTemp.length == 2) {
            this.ftHomeScore = parseScore(ftScoreTemp[0].trim());
            this.ftAwayScore = parseScore(ftScoreTemp[1].trim());
        }

        var htScoreTemp = htScoreStr.replace("HT", "").split("-");
        if (htScoreTemp.length == 2) {
            this.htHomeScore = parseScore(htScoreTemp[0].trim());
            this.htAwayScore = parseScore(htScoreTemp[1].trim());
        }

        var cornerTemp = cornerStr.split("-");
        if (cornerTemp.length == 2) {
            this.homeCorner = parseScore(cornerTemp[0].trim());
            this.awayCorner = parseScore(cornerTemp[1].trim());
        }
    }

    public CrawledEventDTO toCrawledEventDTO() {
        return new CrawledEventDTO(
                externalId, homeName, awayName, homeUrl, awayUrl,
                eventName, eventDate, countryName, leagueName, leagueUrl,
                detailLink, ftHomeScore, ftAwayScore, htHomeScore, htAwayScore,
                ftScoreStr, htScoreStr, homeCorner, awayCorner, providerStatus
        );
    }

    private Integer parseScore(String score) {
        try {
            return Integer.parseInt(score.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

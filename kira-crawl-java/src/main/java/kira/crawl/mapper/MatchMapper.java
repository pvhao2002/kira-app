package kira.crawl.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import kira.crawl.dto.*;
import kira.crawl.util.JsonRecords;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static kira.crawl.util.JsonRecords.*;

@Component
public class MatchMapper {

    public CrawledMatchBundleDto mapDatabaseEvent(JsonNode match, JsonNode decoded) {
        var matchRecord = asRecord(match);
        var competition = findById(decoded.get("competitions"), entityId(matchRecord.get("competition")));
        var homeTeam = findById(decoded.get("teams"), entityId(matchRecord.get("homeTeam")));
        var awayTeam = findById(decoded.get("teams"), entityId(matchRecord.get("awayTeam")));
        var homeScores = numberArray(matchRecord.get("homeScores"));
        var awayScores = numberArray(matchRecord.get("awayScores"));
        var homeName = stringValue(homeTeam.get("name"));
        var awayName = stringValue(awayTeam.get("name"));

        return new CrawledMatchBundleDto(
                mapLeague(competition),
                mapTeam(homeTeam),
                mapTeam(awayTeam),
                new CrawlEventDto(
                        stringValue(matchRecord.get("id")),
                        stringValue(competition.get("id")),
                        stringValue(homeTeam.get("id")),
                        stringValue(awayTeam.get("id")),
                        homeName != null && awayName != null ? homeName + " - " + awayName : null,
                        toGmt7DateTime(matchRecord.get("matchTime")),
                        mapEventStatus(matchRecord),
                        numberValue(matchRecord.get("statusId")),
                        buildMatchLink(matchRecord, homeTeam, awayTeam),
                        numberValue(matchRecord.get("matchStatus"))
                ),
                mapResultForDatabase(homeScores, awayScores)
        );
    }

    public CrawlEventResultDto mapEventResultForDatabase(List<Integer> homeScores, List<Integer> awayScores, JsonNode teamStats) {
        var fullTimeStats = asRecord(asRecord(teamStats.get("matchStats")).get("0"));
        var halfTimeStats = asRecord(asRecord(teamStats.get("matchStats")).get("1"));

        var htHomeGoal = getScore(homeScores, 1);
        var htAwayGoal = getScore(awayScores, 1);
        var ftHomeGoal = getScore(homeScores, 0);
        var ftAwayGoal = getScore(awayScores, 0);

        var htHomeCorner = statValue(halfTimeStats, "102", 0);
        var htAwayCorner = statValue(halfTimeStats, "102", 1);
        var ftHomeCorner = statValue(fullTimeStats, "102", 0);
        var ftAwayCorner = statValue(fullTimeStats, "102", 1);

        var htHomeYellowCard = statValue(halfTimeStats, "101", 0);
        var htAwayYellowCard = statValue(halfTimeStats, "101", 1);
        var ftHomeYellowCard = statValue(fullTimeStats, "101", 0);
        var ftAwayYellowCard = statValue(fullTimeStats, "101", 1);

        var htHomeFoul = statValue(halfTimeStats, "105", 0);
        var htAwayFoul = statValue(halfTimeStats, "105", 1);
        var ftHomeFoul = statValue(fullTimeStats, "105", 0);
        var ftAwayFoul = statValue(fullTimeStats, "105", 1);

        var htHomeOffside = statValue(halfTimeStats, "103", 0);
        var htAwayOffside = statValue(halfTimeStats, "103", 1);
        var ftHomeOffside = statValue(fullTimeStats, "103", 0);
        var ftAwayOffside = statValue(fullTimeStats, "103", 1);

        var htHomeTotalShot = statValue(halfTimeStats, "150", 0);
        var htAwayTotalShot = statValue(halfTimeStats, "150", 1);
        var ftHomeTotalShot = statValue(fullTimeStats, "150", 0);
        var ftAwayTotalShot = statValue(fullTimeStats, "150", 1);

        var htHomeShotOnTarget = statValue(halfTimeStats, "149", 0);
        var htAwayShotOnTarget = statValue(halfTimeStats, "149", 1);
        var ftHomeShotOnTarget = statValue(fullTimeStats, "149", 0);
        var ftAwayShotOnTarget = statValue(fullTimeStats, "149", 1);

        return new CrawlEventResultDto(
                matchOutcome(htHomeGoal, htAwayGoal),
                goalString(htHomeGoal, htAwayGoal),
                matchOutcome(ftHomeGoal, ftAwayGoal),
                goalString(ftHomeGoal, ftAwayGoal),
                htHomeGoal, htAwayGoal, ftHomeGoal, ftAwayGoal,
                htHomeCorner, htAwayCorner, ftHomeCorner, ftAwayCorner,
                htHomeYellowCard, htAwayYellowCard, ftHomeYellowCard, ftAwayYellowCard,
                htHomeFoul, htAwayFoul, ftHomeFoul, ftAwayFoul,
                htHomeOffside, htAwayOffside, ftHomeOffside, ftAwayOffside,
                htHomeTotalShot, htAwayTotalShot, ftHomeTotalShot, ftAwayTotalShot,
                htHomeShotOnTarget, htAwayShotOnTarget, ftHomeShotOnTarget, ftAwayShotOnTarget
        );
    }

    public CrawlEventResultDto mapResultForDatabase(List<Integer> homeScores, List<Integer> awayScores) {
        var htHomeGoal = getScore(homeScores, 1);
        var htAwayGoal = getScore(awayScores, 1);
        var ftHomeGoal = getScore(homeScores, 0);
        var ftAwayGoal = getScore(awayScores, 0);

        return new CrawlEventResultDto(
                matchOutcome(htHomeGoal, htAwayGoal),
                goalString(htHomeGoal, htAwayGoal),
                matchOutcome(ftHomeGoal, ftAwayGoal),
                goalString(ftHomeGoal, ftAwayGoal),
                htHomeGoal, htAwayGoal, ftHomeGoal, ftAwayGoal,
                null, null,
                getScore(homeScores, 4), getScore(awayScores, 4),
                null, null,
                getScore(homeScores, 3), getScore(awayScores, 3),
                null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                null, null, null, null
        );
    }

    private CrawlLeagueDto mapLeague(JsonNode competition) {
        var country = asRecord(competition.get("country"));
        return new CrawlLeagueDto(
                stringValue(competition.get("id")),
                stringValue(competition.get("name")),
                fullLogoUrl(stringValue(competition.get("logo")), "competition"),
                stringValue(country.get("name")),
                stringValue(country.get("iso")),
                numberValue(competition.get("hasStats")),
                stringValue(competition.get("slug")),
                numberValue(competition.get("sportId")),
                stringValue(competition.get("color"))
        );
    }

    private CrawlTeamDto mapTeam(JsonNode team) {
        return new CrawlTeamDto(
                stringValue(team.get("id")),
                stringValue(team.get("name")),
                fullLogoUrl(stringValue(team.get("logo")), "team"),
                numberValue(team.get("sportId"))
        );
    }

    private Integer getScore(List<Integer> scores, int index) {
        return index < scores.size() ? scores.get(index) : null;
    }

    private Integer statValue(JsonNode periodStats, String statId, int teamIndex) {
        var stat = asRecord(asRecord(periodStats.get("stats")).get(statId));
        var values = stringArray(stat.get("values"));
        if (teamIndex >= values.size()) {
            return null;
        }
        var value = values.get(teamIndex);
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String toGmt7DateTime(JsonNode value) {
        var seconds = numberValue(value);
        if (seconds == null) {
            return null;
        }
        return Instant.ofEpochSecond(seconds + 7L * 60 * 60)
                .atOffset(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"))
                + "+07:00";
    }

    private String fullLogoUrl(String value, String type) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return value;
        }
        return "https://img0.aiscore.com/football/" + type + "/" + value;
    }

    private String buildMatchLink(JsonNode match, JsonNode homeTeam, JsonNode awayTeam) {
        var id = stringValue(match.get("id"));
        if (id == null) {
            return null;
        }
        var homeSlug = teamSlug(homeTeam);
        var awaySlug = teamSlug(awayTeam);
        if (homeSlug == null || awaySlug == null) {
            return "https://www.aiscore.com/match/" + id;
        }
        return "https://www.aiscore.com/match-" + homeSlug + "-" + awaySlug + "/" + id;
    }

    private String teamSlug(JsonNode team) {
        var slug = stringValue(team.get("slug"));
        return slug != null ? slug : slugify(stringValue(team.get("name")));
    }

    private String slugify(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        var slug = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replace("&", " and ")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return slug.isBlank() ? null : slug;
    }

    private String mapEventStatus(JsonNode match) {
        var statusId = numberValue(match.get("statusId"));
        if (statusId != null && statusId == 8) {
            return "FT";
        }
        if (statusId != null) {
            return String.valueOf(statusId);
        }
        var matchStatus = numberValue(match.get("matchStatus"));
        return matchStatus != null ? String.valueOf(matchStatus) : "-";
    }

    private String matchOutcome(Integer home, Integer away) {
        if (home == null || away == null) {
            return "None";
        }
        if (home > away) {
            return "H";
        }
        if (home < away) {
            return "A";
        }
        return "D";
    }

    private String goalString(Integer home, Integer away) {
        return home == null || away == null ? null : home + "-" + away;
    }
}

package kira.crawl.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import kira.crawl.dto.CrawlOddsSnapshotDto;
import kira.crawl.dto.CrawlOddsTimelineGroupDto;
import kira.crawl.dto.CrawlOddsTimelineItemDto;
import org.springframework.stereotype.Component;

import kira.crawl.util.JsonRecords;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static kira.crawl.util.JsonRecords.*;

@Component
public class OddsMapper {

    public record OddsDetails(
            JsonNode asia,
            JsonNode eu,
            JsonNode bs,
            JsonNode corner
    ) {
    }

    public List<CrawlOddsSnapshotDto> mapOddsForDatabase(OddsDetails oddsDetails) {
        var timelineOdds = mapOddsTimelineForDatabase(oddsDetails);
        var snapshots = new ArrayList<CrawlOddsSnapshotDto>();
        snapshots.addAll(pickOddsSnapshotsByStatus(timelineOdds, "open", 1, "first"));
        snapshots.addAll(pickOddsSnapshotsByStatus(timelineOdds, "pre-match", 1, "last"));
        snapshots.addAll(pickOddsSnapshotsByStatus(timelineOdds, "half-time", 3, "last"));
        return snapshots;
    }

    public List<CrawlOddsSnapshotDto> mapOddsListForDatabase(JsonNode oddsList) {
        var snapshots = new ArrayList<CrawlOddsSnapshotDto>();
        snapshots.addAll(mapOddsListMarketForDatabase("hdc", asArray(oddsList.get("asia"))));
        snapshots.addAll(mapOddsListMarketForDatabase("ou", asArray(oddsList.get("bs"))));
        snapshots.addAll(mapOddsListMarketForDatabase("corner", asArray(oddsList.get("corner"))));
        return snapshots;
    }

    public List<CrawlOddsTimelineItemDto> mapOddsTimelineForDatabase(OddsDetails oddsDetails) {
        if (JsonRecords.isEmptyObject(oddsDetails.asia())
                && JsonRecords.isEmptyObject(oddsDetails.eu())
                && JsonRecords.isEmptyObject(oddsDetails.bs())
                && JsonRecords.isEmptyObject(oddsDetails.corner())) {
            return List.of();
        }

        var timeline = new ArrayList<CrawlOddsTimelineItemDto>();
        timeline.addAll(mapOddsDetailItems("hdc", oddsDetailItems(oddsDetails.asia())));
        timeline.addAll(mapOddsDetailItems("ou", oddsDetailItems(oddsDetails.bs())));
        timeline.addAll(mapOddsDetailItems("corner", oddsDetailItems(oddsDetails.corner())));
        return timeline;
    }

    public CrawlOddsTimelineGroupDto groupOddsTimelineForResponse(List<CrawlOddsTimelineItemDto> timeline) {
        return new CrawlOddsTimelineGroupDto(
                timeline.stream().filter(item -> "hdc".equals(item.market())).toList(),
                timeline.stream().filter(item -> "ou".equals(item.market())).toList(),
                timeline.stream().filter(item -> "corner".equals(item.market())).toList()
        );
    }

    public boolean hasBet365Company(JsonNode oddsList) {
        return asArray(oddsList.get("companies")).stream()
                .anyMatch(value -> isBet365Company(asRecord(value)));
    }

    public boolean hasCornerMarket(JsonNode oddsList) {
        return !mapOddsListMarketForDatabase("corner", asArray(oddsList.get("corner"))).isEmpty();
    }

    public boolean isBet365Company(JsonNode company) {
        var companyId = numberValue(company.get("id"));
        var companyName = stringValue(company.get("name"));
        var normalized = companyName == null ? "" : companyName.replaceAll("\\s+", "").toLowerCase();
        return (companyId != null && companyId == 2) || "bet365".equals(normalized);
    }

    private List<CrawlOddsSnapshotDto> mapOddsListMarketForDatabase(String market, List<JsonNode> items) {
        var bet365Odds = items.stream()
                .map(JsonRecords::asRecord)
                .filter(item -> isBet365Company(asRecord(item.get("company"))))
                .findFirst()
                .orElse(null);
        if (bet365Odds == null) {
            return List.of();
        }

        var snapshots = new ArrayList<CrawlOddsSnapshotDto>();
        addIfNotNull(snapshots, mapOddsListItemForDatabase("open", market, bet365Odds.get("f")));
        addIfNotNull(snapshots, mapOddsListItemForDatabase("pre-match", market, bet365Odds.get("s")));
        addIfNotNull(snapshots, mapOddsListItemForDatabase("half-time", market, bet365Odds.get("l")));
        return snapshots;
    }

    private CrawlOddsSnapshotDto mapOddsListItemForDatabase(String type, String market, JsonNode value) {
        var odds = stringArray(asRecord(value).get("odd"));
        var priceA = decimalString(getString(odds, 0));
        var line = formatOddLine(market, getString(odds, 1));
        var priceB = decimalString(getString(odds, 2));
        if (priceA == null || line == null || priceB == null) {
            return null;
        }
        return new CrawlOddsSnapshotDto(type, market, line, priceA, priceB);
    }

    private List<JsonNode> oddsDetailItems(JsonNode detailBody) {
        if (JsonRecords.isEmptyObject(detailBody)) {
            return List.of();
        }
        var items = new ArrayList<JsonNode>();
        for (var companyOddDetail : asArray(detailBody.get("oddsDetail"))) {
            items.addAll(asArray(asRecord(companyOddDetail).get("details")));
        }
        return items;
    }

    private List<CrawlOddsTimelineItemDto> mapOddsDetailItems(String market, List<JsonNode> items) {
        var result = new ArrayList<CrawlOddsTimelineItemDto>();
        for (var item : items) {
            var detail = asRecord(item);
            var line = formatOddLine(market, stringValue(detail.get("d")));
            var priceA = decimalString(stringValue(detail.get("w")));
            var priceB = decimalString(stringValue(detail.get("l")));
            if (line == null || priceA == null || priceB == null) {
                continue;
            }
            result.add(new CrawlOddsTimelineItemDto(
                    market,
                    line,
                    priceA,
                    priceB,
                    stringValue(detail.get("time")),
                    toGmt7DateTime(detail.get("updateTime")),
                    stringValue(detail.get("score")),
                    numberValue(detail.get("statusId"))
            ));
        }
        return result;
    }

    private List<CrawlOddsSnapshotDto> pickOddsSnapshotsByStatus(
            List<CrawlOddsTimelineItemDto> timeline,
            String type,
            int statusId,
            String position
    ) {
        var grouped = new HashMap<String, List<CrawlOddsTimelineItemDto>>();
        for (var item : timeline) {
            if (item.statusId() == null || item.statusId() != statusId) {
                continue;
            }
            grouped.computeIfAbsent(item.market(), key -> new ArrayList<>()).add(item);
        }

        var snapshots = new ArrayList<CrawlOddsSnapshotDto>();
        for (var entry : grouped.entrySet()) {
            var sortedItems = entry.getValue().stream()
                    .sorted(Comparator.comparingLong(item -> oddTimeValue(item.crawledAt())))
                    .toList();
            if (sortedItems.isEmpty()) {
                continue;
            }
            var selected = "first".equals(position) ? sortedItems.getFirst() : sortedItems.getLast();
            snapshots.add(new CrawlOddsSnapshotDto(
                    type,
                    entry.getKey(),
                    selected.line(),
                    selected.priceA(),
                    selected.priceB()
            ));
        }
        return snapshots;
    }

    private long oddTimeValue(String value) {
        if (value == null || value.isBlank()) {
            return 0L;
        }
        try {
            return Instant.parse(value).toEpochMilli();
        } catch (Exception ex) {
            return 0L;
        }
    }

    private String formatOddLine(String market, String line) {
        if (!"hdc".equals(market)) {
            return decimalString(line);
        }
        var handicap = numberFromString(line);
        if (handicap == null) {
            return null;
        }
        if (handicap == 0) {
            return "0#0";
        }
        var absHandicap = Math.abs(handicap);
        var homeSign = handicap > 0 ? "-" : "+";
        var awaySign = handicap > 0 ? "+" : "-";
        return homeSign + formatAsianHandicap(absHandicap) + "#" + awaySign + formatAsianHandicap(absHandicap);
    }

    private String formatAsianHandicap(double value) {
        var rounded = Math.round(value * 4.0) / 4.0;
        var lowerHalf = Math.floor(rounded * 2.0) / 2.0;
        var upperHalf = Math.ceil(rounded * 2.0) / 2.0;
        if (lowerHalf == upperHalf) {
            return trimDecimal(lowerHalf);
        }
        return trimDecimal(lowerHalf) + "/" + trimDecimal(upperHalf);
    }

    private String trimDecimal(double value) {
        if (value == Math.rint(value)) {
            return String.valueOf((long) value);
        }
        return String.valueOf(value).replaceAll("\\.0$", "");
    }

    private Double numberFromString(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String decimalString(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            Double.parseDouble(value);
            return value;
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

    private String getString(List<String> values, int index) {
        return index < values.size() ? values.get(index) : null;
    }

    private void addIfNotNull(List<CrawlOddsSnapshotDto> snapshots, CrawlOddsSnapshotDto snapshot) {
        if (snapshot != null) {
            snapshots.add(snapshot);
        }
    }
}

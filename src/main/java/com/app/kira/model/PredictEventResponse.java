package com.app.kira.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictEventResponse {
    private String leagueName;
    private Boolean isMainLeague;
    private List<PredictEvent> events;

    public PredictEventResponse(Map.Entry<String, List<PredictEvent>> entry) {
        this.leagueName = entry.getKey();
        this.isMainLeague = entry.getValue().getFirst().getIsMainLeague();
        this.events = entry.getValue()
                .stream()
                .collect(Collectors.groupingBy(PredictEvent::getPredictId, LinkedHashMap::new, Collectors.toList()))
                .entrySet()
                .stream()
                .map(PredictEvent::new)
                .toList();
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PredictEvent {
        @JsonIgnore
        private Long predictId;
        private String eventName;
        private String eventDate;
        @JsonIgnore
        private String leagueName;
        @JsonIgnore
        private Boolean isMainLeague;
        private String eventLink;
        private String homeLogo;
        private String awayLogo;

        private String firstHdc;
        private Double firstHomeOdds;
        private Double firstAwayOdds;
        private String lastHdc;
        private Double lastHomeOdds;
        private Double lastAwayOdds;

        private String firstOu;
        private Double firstOverOdds;
        private Double firstUnderOdds;
        private String lastOu;
        private Double lastOverOdds;
        private Double lastUnderOdds;
        private List<PredictDetail> picks;

        public PredictEvent(Map.Entry<Long, List<PredictEvent>> entry) {
            var evt = entry.getValue().getFirst();
            this.eventName = evt.getEventName();
            this.eventDate = evt.getEventDate();
            this.eventLink = evt.getEventLink();
            this.homeLogo = evt.getHomeLogo();
            this.awayLogo = evt.getAwayLogo();
            this.firstHdc = evt.getFirstHdc();
            this.firstHomeOdds = evt.getFirstHomeOdds();
            this.firstAwayOdds = evt.getFirstAwayOdds();
            this.lastHdc = evt.getLastHdc();
            this.lastHomeOdds = evt.getLastHomeOdds();
            this.lastAwayOdds = evt.getLastAwayOdds();
            this.firstOu = evt.getFirstOu();
            this.firstOverOdds = evt.getFirstOverOdds();
            this.firstUnderOdds = evt.getFirstUnderOdds();
            this.lastOu = evt.getLastOu();
            this.lastOverOdds = evt.getLastOverOdds();
            this.lastUnderOdds = evt.getLastUnderOdds();
            this.picks = entry.getValue().stream().map(PredictDetail::new).toList();
        }

        @JsonIgnore
        private String predictType;
        @JsonIgnore
        private String hdcPick;
        @JsonIgnore
        private String ouPick;
        @JsonIgnore
        private String predictScore;
        @JsonIgnore
        private Integer hdcCount;
        @JsonIgnore
        private Integer ouCount;
        @JsonIgnore
        private Integer matchCount;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PredictDetail {
        private String predictType;
        private String hdcPick;
        private String ouPick;
        private String predictScore;
        private Integer hdcCount;
        private Integer ouCount;
        private Integer matchCount;

        public PredictDetail(PredictEvent event) {
            this.predictType = event.getPredictType();
            this.hdcPick = event.getHdcPick();
            this.ouPick = event.getOuPick();
            this.predictScore = event.getPredictScore();
            this.hdcCount = event.getHdcCount();
            this.ouCount = event.getOuCount();
            this.matchCount = event.getMatchCount();
        }
    }

}

package com.app.kira.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictEventResponse {
    private String leagueName;
    private List<PredictEvent> events;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PredictEvent {
        private String eventName;
        private String eventDate;
        private String leagueName;
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

        private String predictScore;
        private String hdcPick;
        private String ouPick;
    }

}

package com.app.kira.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TodayEventResponse {
    private String leagueName;
    private List<TodayEvent> events;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class TodayEvent {
        private long eventId;
        private String eventName;
        private String eventDate;
        private String leagueName;
        private String link;

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
    }

}

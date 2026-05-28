package com.queue.kiraqueue.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PredictJobMessage(Long eventId, String versionCode) {

    public static final String VERSION_BASE_DATA = "base_data";
    public static final String VERSION_ODDS_MOVEMENT = "odds_movement";
}

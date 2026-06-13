package com.queue.kiraqueue.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PredictJobMessage(Long eventId, String versionCode) {

    public static final String VERSION_NO_PRICE = "NO_PRICE";
    public static final String VERSION_WITH_PRICE = "WITH_PRICE";
    public static final String VERSION_WITH_LEAGUE_NO_PRICE = "WITH_LEAGUE_NO_PRICE";

    /** @deprecated replaced by {@link #VERSION_NO_PRICE} */
    @Deprecated
    public static final String VERSION_BASE_DATA = "base_data";
    /** @deprecated replaced by {@link #VERSION_WITH_PRICE} */
    @Deprecated
    public static final String VERSION_ODDS_MOVEMENT = "odds_movement";
}

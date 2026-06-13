package kira.schema.dto;

/**
 * RabbitMQ payload for {@code prediction} queue jobs.
 * When {@code versionCode} is null, consumer runs all active prediction versions.
 */
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

package kira.producer.dto;

public record PredictJobMessage(Long eventId, String versionCode) {

    public static final String VERSION_NO_PRICE = "NO_PRICE";
    public static final String VERSION_WITH_PRICE = "WITH_PRICE";
    public static final String VERSION_WITH_LEAGUE_NO_PRICE = "WITH_LEAGUE_NO_PRICE";
}

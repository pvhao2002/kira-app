package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EventHistoryOdds(
        EventHistoryOddsSection hdc,
        EventHistoryOddsSection ou,
        EventHistoryOddsSection corner
) {
}

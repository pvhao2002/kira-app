package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EventHistoryOddsSection(
        EventHistoryOddsInfo open,
        EventHistoryOddsInfo pre,
        EventHistoryOddsInfo ht
) {
}

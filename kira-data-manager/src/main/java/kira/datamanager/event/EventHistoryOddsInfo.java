package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EventHistoryOddsInfo(
        String line,
        BigDecimal priceA,
        BigDecimal priceB
) {
}

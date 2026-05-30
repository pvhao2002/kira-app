package kira.datamanager.event;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EventOddsTimelineEntry(
        String market,
        String line,
        BigDecimal priceA,
        BigDecimal priceB,
        String matchMinute,
        LocalDateTime crawledAt
) {
}

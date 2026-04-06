package kira.crawl.app.dto;

import java.math.BigDecimal;

public record OddsTimelineItemDTO(
        String line,
        BigDecimal priceA,
        BigDecimal priceB,
        String matchMinute,
        String date
) {
}

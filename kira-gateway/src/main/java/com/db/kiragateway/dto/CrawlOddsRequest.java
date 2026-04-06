package com.db.kiragateway.dto;

import java.util.List;

public record CrawlOddsRequest(
        String market,
        List<OddsTimelineItemDTO> timeline
) {
}

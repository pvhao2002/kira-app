package com.db.kiragateway.dto;

import java.util.Map;

public record CrawlStatsRequest(
        Map<String, int[]> htStats,
        Map<String, int[]> ftStats
) {
}

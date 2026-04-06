package com.db.kiragateway.dto;

import java.util.List;

public record CrawlEventsRequest(List<CrawledEventDTO> events) {
}

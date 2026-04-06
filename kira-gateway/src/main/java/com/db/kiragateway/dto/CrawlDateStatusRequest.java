package com.db.kiragateway.dto;

public record CrawlDateStatusRequest(String status, int totalEvents, String message) {
}

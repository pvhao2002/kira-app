package kira.datamanager.crawl;

import java.util.List;

public record CrawlDatePageResponse(
        List<CrawlDateRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

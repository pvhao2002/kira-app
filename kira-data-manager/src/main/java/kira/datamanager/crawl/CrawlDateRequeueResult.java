package kira.datamanager.crawl;

import org.springframework.http.HttpStatusCode;

import java.util.Map;

public record CrawlDateRequeueResult(HttpStatusCode status, Map<String, Object> body) {
}

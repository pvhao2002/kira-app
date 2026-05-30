package kira.crawl.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.odds-crawl-job")
public record OddsCrawlJobProperties(
        boolean enabled,
        long fixedDelaySeconds,
        String instanceId,
        long readTimeoutMs
) {
}

package kira.crawl.browser;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import kira.crawl.config.PlaywrightProperties;
import lombok.extern.slf4j.Slf4j;

import java.util.EnumMap;
import java.util.Map;

@Slf4j
public class PlaywrightCrawlLanes implements AutoCloseable {

    private final Map<BrowserApiType, PlaywrightCrawlLane> lanes;

    public PlaywrightCrawlLanes(PlaywrightProperties properties) {
        this.lanes = new EnumMap<>(BrowserApiType.class);
        for (var apiType : BrowserApiType.values()) {
            lanes.put(apiType, new PlaywrightCrawlLane(apiType, properties));
        }
    }

    public PlaywrightCrawlLane lane(BrowserApiType apiType) {
        var lane = lanes.get(apiType);
        if (lane == null) {
            throw new IllegalArgumentException("Unknown crawl lane: " + apiType);
        }
        return lane;
    }

    @PostConstruct
    void warmup() {
        long start = System.currentTimeMillis();
        for (var entry : lanes.entrySet()) {
            long laneStart = System.currentTimeMillis();
            entry.getValue().warmup();
            log.info(
                    "Playwright crawl lane warmed apiType={} durationMs={}",
                    entry.getKey(),
                    System.currentTimeMillis() - laneStart
            );
        }
        log.info(
                "Playwright crawl lanes ready count={} totalDurationMs={} leanNetwork={}",
                lanes.size(),
                System.currentTimeMillis() - start,
                kira.crawl.util.PlaywrightBrowserSupport.isLeanNetworkEnabled()
        );
    }

    @PreDestroy
    @Override
    public void close() {
        for (var entry : lanes.entrySet()) {
            try {
                entry.getValue().close();
                log.info("Playwright crawl lane closed apiType={}", entry.getKey());
            } catch (Exception ex) {
                log.warn("Failed to close Playwright crawl lane apiType={}", entry.getKey(), ex);
            }
        }
    }
}

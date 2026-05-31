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

    /**
     * Lane types excluded from pre-warming at startup.
     * ODDS crawl uses PlaywrightUtils.withPlaywright (per-request browser) via v3 endpoint,
     * so the ODDS lane does not need to hold a warm context.
     */
    private static final java.util.Set<BrowserApiType> SKIP_WARMUP =
            java.util.Set.of(BrowserApiType.ODDS);

    @PostConstruct
    void warmup() {
        long start = System.currentTimeMillis();
        int warmedCount = 0;
        for (var entry : lanes.entrySet()) {
            if (SKIP_WARMUP.contains(entry.getKey())) {
                log.info("Playwright crawl lane warmup skipped apiType={}", entry.getKey());
                continue;
            }
            long laneStart = System.currentTimeMillis();
            entry.getValue().warmup();
            warmedCount++;
            log.info(
                    "Playwright crawl lane warmed apiType={} durationMs={}",
                    entry.getKey(),
                    System.currentTimeMillis() - laneStart
            );
        }
        log.info(
                "Playwright crawl lanes ready warmed={} skipped={} totalDurationMs={} leanNetwork={}",
                warmedCount,
                SKIP_WARMUP.size(),
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

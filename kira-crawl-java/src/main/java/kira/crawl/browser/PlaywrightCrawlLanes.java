package kira.crawl.browser;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.util.PlaywrightBrowserSupport;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
public class PlaywrightCrawlLanes implements AutoCloseable {

    private final Map<BrowserApiType, PlaywrightCrawlLane> lanes;
    private final List<PlaywrightCrawlLane> oddsLanes;
    private final AtomicInteger oddsLaneCursor = new AtomicInteger();

    public PlaywrightCrawlLanes(PlaywrightProperties properties) {
        this.lanes = new EnumMap<>(BrowserApiType.class);
        lanes.put(BrowserApiType.MATCHES, new PlaywrightCrawlLane(BrowserApiType.MATCHES, properties));

        var oddsConcurrency = Math.max(1, Math.min(8, properties.oddsConcurrency()));
        oddsLanes = new ArrayList<>(oddsConcurrency);
        for (int slot = 0; slot < oddsConcurrency; slot++) {
            oddsLanes.add(new PlaywrightCrawlLane(BrowserApiType.ODDS, properties, slot));
        }
        lanes.put(BrowserApiType.ODDS, oddsLanes.getFirst());
        log.info("Playwright ODDS crawl lanes configured concurrency={}", oddsConcurrency);
    }

    /**
     * Returns the MATCHES lane, or a round-robin ODDS lane when {@code oddsConcurrency > 1}.
     */
    public PlaywrightCrawlLane lane(BrowserApiType apiType) {
        if (apiType == null) {
            throw new IllegalArgumentException("Unknown crawl lane: null");
        }
        if (apiType == BrowserApiType.ODDS && oddsLanes.size() > 1) {
            return acquireOddsLane();
        }
        var lane = lanes.get(apiType);
        if (lane == null) {
            throw new IllegalArgumentException("Unknown crawl lane: " + apiType);
        }
        return lane;
    }

    public int oddsLaneCount() {
        return oddsLanes.size();
    }

    private PlaywrightCrawlLane acquireOddsLane() {
        var index = Math.floorMod(oddsLaneCursor.getAndIncrement(), oddsLanes.size());
        return oddsLanes.get(index);
    }

    @PostConstruct
    void warmup() {
        long start = System.currentTimeMillis();
        int warmedCount = 0;
        warmupLane(BrowserApiType.MATCHES, lanes.get(BrowserApiType.MATCHES));
        warmedCount++;
        for (var oddsLane : oddsLanes) {
            warmupLane(BrowserApiType.ODDS, oddsLane);
            warmedCount++;
        }
        log.info(
                "Playwright crawl lanes ready warmed={} oddsConcurrency={} totalDurationMs={} leanNetwork={}",
                warmedCount,
                oddsLanes.size(),
                System.currentTimeMillis() - start,
                PlaywrightBrowserSupport.isLeanNetworkEnabled()
        );
    }

    private void warmupLane(BrowserApiType apiType, PlaywrightCrawlLane lane) {
        long laneStart = System.currentTimeMillis();
        lane.warmup();
        log.info(
                "Playwright crawl lane warmed apiType={} slot={} durationMs={}",
                apiType,
                lane.slot(),
                System.currentTimeMillis() - laneStart
        );
    }

    @PreDestroy
    @Override
    public void close() {
        var closed = new ArrayList<PlaywrightCrawlLane>();
        closed.add(lanes.get(BrowserApiType.MATCHES));
        closed.addAll(oddsLanes);
        for (var lane : closed) {
            if (lane == null) {
                continue;
            }
            try {
                lane.close();
                log.info("Playwright crawl lane closed apiType={} slot={}", lane.apiType(), lane.slot());
            } catch (Exception ex) {
                log.warn("Failed to close Playwright crawl lane apiType={} slot={}", lane.apiType(), lane.slot(), ex);
            }
        }
    }
}

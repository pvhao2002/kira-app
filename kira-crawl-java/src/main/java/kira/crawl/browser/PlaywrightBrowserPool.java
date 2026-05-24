package kira.crawl.browser;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.Cookie;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import kira.crawl.config.PlaywrightProperties;
import lombok.extern.slf4j.Slf4j;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

@Slf4j
public class PlaywrightBrowserPool implements AutoCloseable {

    private final PlaywrightProperties properties;
    private final Map<BrowserApiType, Playwright> playwrights;
    private final Map<BrowserApiType, ApiPool> pools;

    public PlaywrightBrowserPool(PlaywrightProperties properties) {
        this(properties, null);
    }

    public PlaywrightBrowserPool(PlaywrightProperties properties, MeterRegistry meterRegistry) {
        this.properties = properties;
        this.playwrights = new EnumMap<>(BrowserApiType.class);
        for (var apiType : BrowserApiType.values()) {
            playwrights.put(apiType, Playwright.create());
        }
        this.pools = Map.of(
                BrowserApiType.MATCHES, createPool(BrowserApiType.MATCHES, properties.matchesConcurrency(), meterRegistry),
                BrowserApiType.ODDS, createPool(BrowserApiType.ODDS, properties.oddsConcurrency(), meterRegistry)
        );
        log.info(
                "Playwright profile instance: {} (serverPort={}, explicitInstanceId={}, drivers={})",
                properties.resolvedProfileInstanceId(),
                properties.serverPort(),
                properties.profileInstanceId(),
                playwrights.size()
        );
    }

    private ApiPool createPool(BrowserApiType apiType, int size, MeterRegistry meterRegistry) {
        var pool = new ApiPool(playwrights.get(apiType), apiType, Math.max(1, size));
        if (meterRegistry != null) {
            Gauge.builder("crawl.browser.pool.available", pool.queue, BlockingQueue::size)
                    .tag("api", apiType.name().toLowerCase())
                    .register(meterRegistry);
            Gauge.builder("crawl.browser.pool.active", pool.active, AtomicInteger::get)
                    .tag("api", apiType.name().toLowerCase())
                    .register(meterRegistry);
        }
        return pool;
    }

    public <T> T withContext(BrowserApiType apiType, Function<BrowserContext, T> handler) {
        var pool = pools.get(apiType);
        PooledContext pooled = null;
        try {
            pooled = pool.acquire();
            pool.active.incrementAndGet();
            return handler.apply(pooled.context());
        } finally {
            if (pooled != null) {
                pool.active.decrementAndGet();
                pool.release(pooled);
            }
        }
    }

    int available(BrowserApiType apiType) {
        return pools.get(apiType).queue.size();
    }

    @PreDestroy
    @Override
    public void close() {
        for (var pool : pools.values()) {
            pool.close();
        }
        for (var entry : playwrights.entrySet()) {
            try {
                entry.getValue().close();
            } catch (Exception ex) {
                log.warn("Failed to close Playwright driver for {}", entry.getKey(), ex);
            }
        }
    }

    private final class ApiPool implements AutoCloseable {
        private final Playwright playwright;
        private final BrowserApiType apiType;
        private final BlockingQueue<Integer> queue;
        private final AtomicInteger active = new AtomicInteger();
        private final int size;
        private final Object launchLock = new Object();

        ApiPool(Playwright playwright, BrowserApiType apiType, int size) {
            this.playwright = playwright;
            this.apiType = apiType;
            this.size = size;
            this.queue = new ArrayBlockingQueue<>(size);
            for (int slot = 0; slot < size; slot++) {
                queue.offer(slot);
            }
        }

        PooledContext acquire() {
            try {
                var slot = queue.poll(properties.acquireTimeoutMs(), TimeUnit.MILLISECONDS);
                if (slot == null) {
                    throw new BrowserPoolExhaustedException(apiType, properties.acquireTimeoutMs());
                }
                var context = createContext(apiType, slot);
                return new PooledContext(context, slot);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new BrowserPoolExhaustedException(apiType, properties.acquireTimeoutMs());
            }
        }

        void release(PooledContext pooled) {
            try {
                pooled.context().close();
            } catch (Exception ex) {
                log.warn("Failed to close browser context slot {} for {}", pooled.slot(), apiType, ex);
            } finally {
                queue.offer(pooled.slot());
            }
        }

        BrowserContext createContext(BrowserApiType type, int slot) {
            var profileDir = profileDir(type, slot);
            profileDir.toFile().mkdirs();

            var launchArgs = new ArrayList<>(List.of(
                    "--disable-blink-features=AutomationControlled",
                    "--no-first-run"
            ));
            if (properties.headless()) {
                launchArgs.add("--headless=new");
            }

            var options = new BrowserType.LaunchPersistentContextOptions()
                    .setHeadless(properties.headless())
                    .setLocale("en-US")
                    .setTimezoneId("Asia/Bangkok")
                    .setUserAgent(properties.userAgent())
                    .setViewportSize(1494, 934)
                    .setArgs(launchArgs)
                    .setExtraHTTPHeaders(Map.of("accept-language", properties.acceptLanguage()));

            if (properties.channel() != null && !properties.channel().isBlank()) {
                options.setChannel(properties.channel());
            }

            BrowserContext context;
            synchronized (launchLock) {
                context = playwright.chromium().launchPersistentContext(profileDir, options);
            }
            context.addInitScript("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    """);

            seedCookies(context);
            return context;
        }

        Path profileDir(BrowserApiType type, int slot) {
            return Path.of(
                    properties.profileBaseDir(),
                    properties.resolvedProfileInstanceId() + "_" + type.name().toLowerCase() + "_s" + slot
            ).toAbsolutePath();
        }

        void seedCookies(BrowserContext context) {
            if (properties.cookie() == null || properties.cookie().isBlank()) {
                return;
            }

            var cookies = Arrays.stream(properties.cookie().split(";"))
                    .map(String::trim)
                    .filter(part -> !part.isBlank())
                    .map(part -> {
                        var idx = part.indexOf('=');
                        if (idx <= 0) {
                            return null;
                        }
                        return new Cookie(part.substring(0, idx), part.substring(idx + 1))
                                .setDomain(".aiscore.com")
                                .setPath("/");
                    })
                    .filter(cookie -> cookie != null && cookie.name != null && !cookie.name.isBlank())
                    .toList();

            if (!cookies.isEmpty()) {
                context.addCookies(cookies);
            }
        }

        @Override
        public void close() {
            queue.clear();
            for (int slot = 0; slot < size; slot++) {
                queue.offer(slot);
            }
        }
    }

    private record PooledContext(BrowserContext context, int slot) {
    }
}

package kira.crawl.util;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.ColorScheme;
import com.microsoft.playwright.options.Cookie;
import kira.crawl.config.PlaywrightProperties;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Per-JVM shared Playwright driver on a dedicated {@code playwright-driver} thread.
 * All pooled context access is serialized per Playwright Java thread-safety rules.
 * Use {@link #runIsolated(boolean, Function)} for parallel benchmarks (one Playwright per caller thread).
 */
@Slf4j
final class PlaywrightRuntime {

    static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private static final int VIEWPORT_WIDTH = 1920;
    private static final int VIEWPORT_HEIGHT = 1080;
    private static final String LOCALE = "en-US";
    private static final String ACCEPT_LANGUAGE = "en-US,en;q=0.9,vi;q=0.8";
    private static final int DEFAULT_POOL_SIZE = 2;

    private static final Set<String> LEAN_NETWORK_BLOCKED_TYPES = Set.of("image", "font", "media");

    private static final String INIT_SCRIPT_STEALTH = """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = window.chrome || { runtime: {} };
            """;

    private static final String DEFAULT_OPTIONS_CLOSED_COOKIE = "optionsClosed";

    private static final PlaywrightRuntime INSTANCE = new PlaywrightRuntime();

    private final ExecutorService playwrightExecutor = Executors.newSingleThreadExecutor(r -> {
        var thread = new Thread(r, "playwright-driver");
        thread.setDaemon(true);
        return thread;
    });
    private final ContextPool contextPool;
    private final AtomicBoolean shutdownHookRegistered = new AtomicBoolean();
    private final AtomicBoolean shutDown = new AtomicBoolean();

    private volatile boolean headless = true;
    private volatile String userAgent = USER_AGENT;
    private volatile String acceptLanguage = ACCEPT_LANGUAGE;
    private volatile String cookieConfig = "";

    private Playwright playwright;
    private Browser browser;
    private boolean browserHeadless = true;

    private PlaywrightRuntime() {
        contextPool = new ContextPool(resolvePoolSize());
    }

    static PlaywrightRuntime getInstance() {
        return INSTANCE;
    }

    void bindProperties(PlaywrightProperties properties) {
        if (properties == null) {
            return;
        }
        headless = properties.headless();
        if (properties.userAgent() != null && !properties.userAgent().isBlank()) {
            userAgent = properties.userAgent();
        }
        if (properties.acceptLanguage() != null && !properties.acceptLanguage().isBlank()) {
            acceptLanguage = properties.acceptLanguage();
        }
        cookieConfig = properties.cookie() != null ? properties.cookie() : "";
        log.info("PlaywrightRuntime bound (headless={}, leanNetwork={})", headless, isLeanNetworkEnabled());
    }

    static int resolvePoolSize() {
        var raw = System.getenv("PLAYWRIGHT_UTIL_CONTEXT_POOL_SIZE");
        if (raw == null || raw.isBlank()) {
            return DEFAULT_POOL_SIZE;
        }
        try {
            return Math.max(1, Math.min(8, Integer.parseInt(raw.trim())));
        } catch (NumberFormatException ex) {
            return DEFAULT_POOL_SIZE;
        }
    }

    static boolean isLeanNetworkEnabled() {
        var raw = System.getenv("PLAYWRIGHT_UTIL_LEAN_NETWORK");
        if (raw == null || raw.isBlank()) {
            return true;
        }
        return !"false".equalsIgnoreCase(raw.trim()) && !"0".equals(raw.trim());
    }

    /**
     * Runs all Playwright API calls on the dedicated driver thread.
     */
    <T> T call(Supplier<T> action) {
        try {
            return playwrightExecutor.submit(action::get).get();
        } catch (Exception ex) {
            if (ex.getCause() instanceof RuntimeException runtime) {
                throw runtime;
            }
            throw new IllegalStateException("Playwright driver task failed", ex);
        }
    }

    void run(Runnable action) {
        call(() -> {
            action.run();
            return null;
        });
    }

    BrowserContext acquireContext(boolean headless) {
        return call(() -> acquireContextOnDriverThread(headless));
    }

    BrowserContext acquireContextOnDriverThread(boolean headless) {
        return contextPool.acquire(getBrowser(headless));
    }

    void releaseContext(BrowserContext context) {
        run(() -> releaseContextOnDriverThread(context));
    }

    void releaseContextOnDriverThread(BrowserContext context) {
        contextPool.release(context);
    }

    void evictContext(BrowserContext context) {
        run(() -> evictContextOnDriverThread(context));
    }

    void evictContextOnDriverThread(BrowserContext context) {
        contextPool.evict(context);
    }

    /**
     * One Playwright + browser + context on the <em>current</em> thread (for parallel load tests).
     * Does not use the shared singleton driver.
     */
    static <T> T runIsolated(boolean headless, Function<Page, T> action) {
        try (var pw = Playwright.create()) {
            var browser = pw.chromium().launch(launchOptions(headless));
            try {
                var context = INSTANCE.createPreparedContext(browser);
                try {
                    var page = context.newPage();
                    try {
                        return action.apply(page);
                    } finally {
                        closePageQuietly(page);
                    }
                } finally {
                    closeContextQuietly(context);
                }
            } finally {
                closeBrowserQuietly(browser);
            }
        }
    }

    static boolean shouldBlockResourceType(String resourceType) {
        return isLeanNetworkEnabled() && LEAN_NETWORK_BLOCKED_TYPES.contains(resourceType);
    }

    static void installLeanNetwork(BrowserContext context) {
        if (!isLeanNetworkEnabled()) {
            return;
        }
        context.route("**/*", route -> {
            if (shouldBlockResourceType(route.request().resourceType())) {
                route.abort();
                return;
            }
            route.resume();
        });
    }

    private Browser getBrowser(boolean headless) {
        if (browser != null && browser.isConnected() && browserHeadless == headless) {
            return browser;
        }
        closeBrowserUnlocked();
        registerShutdownHook();
        playwright = Playwright.create();
        browser = playwright.chromium().launch(launchOptions(headless));
        browserHeadless = headless;
        return browser;
    }

    private void registerShutdownHook() {
        if (!shutdownHookRegistered.compareAndSet(false, true)) {
            return;
        }
        Runtime.getRuntime().addShutdownHook(new Thread(this::shutdown, "playwright-runtime-shutdown"));
    }

    void shutdown() {
        if (!shutDown.compareAndSet(false, true)) {
            return;
        }
        try {
            playwrightExecutor.submit(() -> {
                contextPool.closeAll();
                closeBrowserUnlocked();
                return null;
            }).get();
        } catch (Exception ex) {
            log.warn("Playwright driver shutdown failed", ex);
        } finally {
            playwrightExecutor.shutdownNow();
        }
    }

    private void closeBrowserUnlocked() {
        if (browser != null) {
            try {
                browser.close();
            } catch (Exception ex) {
                log.warn("Failed to close shared browser", ex);
            }
            browser = null;
        }
        if (playwright != null) {
            try {
                playwright.close();
            } catch (Exception ex) {
                log.warn("Failed to close Playwright driver", ex);
            }
            playwright = null;
        }
    }

    static BrowserType.LaunchOptions launchOptions(boolean headless) {
        var args = new ArrayList<>(List.of(
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-infobars",
                "--disable-dev-shm-usage",
                "--disable-background-networking",
                "--disable-renderer-backgrounding",
                "--window-size=%d,%d".formatted(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
        ));
        if (headless) {
            args.add("--headless=new");
        }
        return new BrowserType.LaunchOptions()
                .setHeadless(headless)
                .setArgs(args);
    }

    Browser.NewContextOptions contextOptions() {
        return new Browser.NewContextOptions()
                .setUserAgent(userAgent)
                .setViewportSize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
                .setLocale(LOCALE)
                .setTimezoneId("Asia/Ho_Chi_Minh")
                .setExtraHTTPHeaders(Map.of("accept-language", acceptLanguage))
                .setIgnoreHTTPSErrors(false)
                .setColorScheme(ColorScheme.LIGHT)
                .setDeviceScaleFactor(1);
    }

    BrowserContext createPreparedContext(Browser browser) {
        var context = browser.newContext(contextOptions());
        installLeanNetwork(context);
        addDefaultContextCookies(context);
        seedCookies(context);
        context.addInitScript(INIT_SCRIPT_STEALTH);
        return context;
    }

    private static void addDefaultContextCookies(BrowserContext context) {
        long ts = System.currentTimeMillis();
        context.addCookies(List.of(
                new Cookie(DEFAULT_OPTIONS_CLOSED_COOKIE, Long.toString(ts))
                        .setDomain("aiscore.com")
                        .setPath("/")
        ));
    }

    private void seedCookies(BrowserContext context) {
        if (cookieConfig == null || cookieConfig.isBlank()) {
            return;
        }

        var cookies = Arrays.stream(cookieConfig.split(";"))
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

    private static void closeAllPages(BrowserContext context) {
        for (var page : new ArrayList<>(context.pages())) {
            closePageQuietly(page);
        }
    }

    private static void closePageQuietly(Page page) {
        if (page == null || page.isClosed()) {
            return;
        }
        try {
            page.close();
        } catch (Exception ex) {
            log.debug("Failed to close page", ex);
        }
    }

    private static void closeContextQuietly(BrowserContext context) {
        if (context == null) {
            return;
        }
        try {
            closeAllPages(context);
            context.close();
        } catch (Exception ex) {
            log.debug("Failed to close browser context", ex);
        }
    }

    private static void closeBrowserQuietly(Browser browser) {
        if (browser == null) {
            return;
        }
        try {
            browser.close();
        } catch (Exception ex) {
            log.debug("Failed to close browser", ex);
        }
    }

    private final class ContextPool {
        private final int maxSize;
        private final BlockingQueue<BrowserContext> idle;
        private final AtomicInteger liveCount = new AtomicInteger();
        private final Object poolMonitor = new Object();

        ContextPool(int maxSize) {
            this.maxSize = maxSize;
            this.idle = new ArrayBlockingQueue<>(maxSize);
        }

        BrowserContext acquire(Browser browser) {
            synchronized (poolMonitor) {
                while (true) {
                    var pooled = takeValidIdle(browser);
                    if (pooled != null) {
                        return pooled;
                    }
                    if (liveCount.get() < maxSize) {
                        liveCount.incrementAndGet();
                        return PlaywrightRuntime.this.createPreparedContext(browser);
                    }
                    try {
                        poolMonitor.wait(5_000);
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("Interrupted while waiting for browser context", ex);
                    }
                }
            }
        }

        void release(BrowserContext context) {
            synchronized (poolMonitor) {
                if (context == null || isContextBroken(context)) {
                    evictQuietly(context);
                    poolMonitor.notifyAll();
                    return;
                }
                closeAllPages(context);
                if (idle.offer(context)) {
                    poolMonitor.notifyAll();
                    return;
                }
                evictQuietly(context);
                poolMonitor.notifyAll();
            }
        }

        void evict(BrowserContext context) {
            synchronized (poolMonitor) {
                evictQuietly(context);
                poolMonitor.notifyAll();
            }
        }

        void closeAll() {
            synchronized (poolMonitor) {
                BrowserContext ctx;
                while ((ctx = idle.poll()) != null) {
                    evictQuietly(ctx);
                }
                liveCount.set(0);
                poolMonitor.notifyAll();
            }
        }

        private BrowserContext takeValidIdle(Browser browser) {
            BrowserContext pooled;
            while ((pooled = idle.poll()) != null) {
                if (pooled.browser() == browser && !isContextBroken(pooled)) {
                    closeAllPages(pooled);
                    return pooled;
                }
                evictQuietly(pooled);
            }
            return null;
        }

        private boolean isContextBroken(BrowserContext context) {
            try {
                return context == null || context.browser() == null || !context.browser().isConnected();
            } catch (Exception ex) {
                return true;
            }
        }

        private void evictQuietly(BrowserContext context) {
            if (context == null) {
                return;
            }
            try {
                closeAllPages(context);
                context.close();
            } catch (Exception ex) {
                log.debug("Failed to evict browser context", ex);
            } finally {
                liveCount.updateAndGet(count -> Math.max(0, count - 1));
            }
        }
    }
}

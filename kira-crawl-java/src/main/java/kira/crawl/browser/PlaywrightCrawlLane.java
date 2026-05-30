package kira.crawl.browser;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.util.PlaywrightBrowserSupport;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BiFunction;
import java.util.function.Supplier;

/**
 * Dedicated Playwright lane for one crawl API ({@link BrowserApiType}).
 * All Playwright calls run on a single driver thread; one warm browser context is reused across requests.
 */
@Slf4j
public class PlaywrightCrawlLane implements AutoCloseable {

    private final BrowserApiType apiType;
    private final PlaywrightProperties properties;
    private final ExecutorService driver;
    private final AtomicBoolean shutDown = new AtomicBoolean();

    private Playwright playwright;
    private Browser browser;
    private BrowserContext context;

    public PlaywrightCrawlLane(BrowserApiType apiType, PlaywrightProperties properties) {
        this.apiType = apiType;
        this.properties = properties;
        this.driver = Executors.newSingleThreadExecutor(r -> {
            var thread = new Thread(r, "playwright-" + apiType.name().toLowerCase() + "-driver");
            thread.setDaemon(true);
            return thread;
        });
    }

    BrowserApiType apiType() {
        return apiType;
    }

    void warmup() {
        call(() -> {
            ensureWarmContext();
            return null;
        });
    }

    <T> T withPage(
            long timeoutMs,
            Map<String, String> extraPageHeaders,
            BiFunction<Page, Long, T> handler
    ) {
        return call(() -> {
            ensureWarmContext();
            var page = context.newPage();
            page.setDefaultTimeout(timeoutMs);
            page.setDefaultNavigationTimeout(timeoutMs);
            if (extraPageHeaders != null && !extraPageHeaders.isEmpty()) {
                page.setExtraHTTPHeaders(extraPageHeaders);
            }
            try {
                return handler.apply(page, timeoutMs);
            } catch (RuntimeException ex) {
                evictContextOnDriverThread();
                throw ex;
            } catch (Exception ex) {
                evictContextOnDriverThread();
                throw new IllegalStateException("Playwright crawl page task failed", ex);
            } finally {
                PlaywrightBrowserSupport.closePageQuietly(page);
            }
        });
    }

    @Override
    public void close() {
        if (!shutDown.compareAndSet(false, true)) {
            return;
        }
        try {
            driver.submit(this::closeOnDriverThread).get();
        } catch (Exception ex) {
            log.warn("Failed to shut down Playwright crawl lane {}", apiType, ex);
        } finally {
            driver.shutdownNow();
        }
    }

    private void closeOnDriverThread() {
        evictContextOnDriverThread();
        PlaywrightBrowserSupport.closeBrowserQuietly(browser);
        browser = null;
        if (playwright != null) {
            try {
                playwright.close();
            } catch (Exception ex) {
                log.debug("Failed to close Playwright for lane {}", apiType, ex);
            }
            playwright = null;
        }
    }

    private void ensureWarmContext() {
        if (context != null && !PlaywrightBrowserSupport.isContextBroken(context)) {
            PlaywrightBrowserSupport.closeAllPages(context);
            return;
        }
        evictContextOnDriverThread();
        if (playwright == null) {
            playwright = Playwright.create();
        }
        if (browser == null || !browser.isConnected()) {
            browser = PlaywrightBrowserSupport.launchBrowser(playwright, properties.headless());
        }
        context = PlaywrightBrowserSupport.createPreparedContext(browser, properties);
    }

    private void evictContextOnDriverThread() {
        PlaywrightBrowserSupport.closeContextQuietly(context);
        context = null;
    }

    private <T> T call(Supplier<T> action) {
        if (shutDown.get()) {
            throw new IllegalStateException("Playwright crawl lane is shut down: " + apiType);
        }
        try {
            return driver.submit(action::get).get();
        } catch (Exception ex) {
            if (ex.getCause() instanceof RuntimeException runtime) {
                throw runtime;
            }
            throw new IllegalStateException("Playwright crawl lane task failed: " + apiType, ex);
        }
    }
}

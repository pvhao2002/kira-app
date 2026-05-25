package kira.crawl.util;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import kira.crawl.config.PlaywrightProperties;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.WaitUntilState;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.logging.Level;

/**
 * Playwright helpers optimized for multi-instance crawl (3–4 JVMs on different ports).
 * <p>
 * Shared browser access runs on a single {@code playwright-driver} thread inside {@link PlaywrightRuntime}
 * so Spring virtual threads can call this util safely. Parallel load tests use
 * {@link PlaywrightRuntime#runIsolated(boolean, java.util.function.Function)} instead.
 */
@Log
@UtilityClass
public class PlaywrightUtil {

    public static final String USER_AGENT = PlaywrightRuntime.USER_AGENT;

    private static final PlaywrightRuntime RUNTIME = PlaywrightRuntime.getInstance();

    public <P> void withPlaywright(P obj, BiConsumer<Page, P> logic) {
        withPlaywright(obj, logic, null);
    }

    public <P> void withPlaywright(P obj, BiConsumer<Page, P> logic, Consumer<Exception> errorHandler) {
        withPlaywright(obj, logic, errorHandler, true);
    }

    /**
     * Runs logic on a single page using a pooled browser context (headless by default).
     */
    public <P> void withPlaywright(
            P obj,
            BiConsumer<Page, P> logic,
            Consumer<Exception> errorHandler,
            boolean headless
    ) {
        RUNTIME.call(() -> {
            var context = RUNTIME.acquireContextOnDriverThread(headless);
            try {
                var page = context.newPage();
                try {
                    logic.accept(page, obj);
                } finally {
                    closePageQuietly(page);
                }
            } catch (Exception e) {
                log.log(Level.WARNING, "withPlaywright >> Error during Playwright task", e);
                RUNTIME.evictContextOnDriverThread(context);
                context = null;
                if (errorHandler != null) {
                    errorHandler.accept(e);
                }
            } finally {
                if (context != null) {
                    RUNTIME.releaseContextOnDriverThread(context);
                }
            }
            return null;
        });
    }

    /**
     * Opens {@code pageCount} tabs in one pooled context on the driver thread.
     */
    public <P> void withPlaywrightPages(int pageCount, BiConsumer<List<Page>, P> logic, P obj) {
        withPlaywrightPages(pageCount, logic, obj, !isRunningProd());
    }

    public <P> void withPlaywrightPages(
            int pageCount,
            BiConsumer<List<Page>, P> logic,
            P obj,
            boolean headless
    ) {
        if (pageCount < 1) {
            throw new IllegalArgumentException("pageCount must be >= 1");
        }
        RUNTIME.call(() -> {
            var context = RUNTIME.acquireContextOnDriverThread(headless);
            var pages = new ArrayList<Page>(pageCount);
            try {
                for (int i = 0; i < pageCount; i++) {
                    pages.add(context.newPage());
                }
                logic.accept(pages, obj);
            } catch (Exception e) {
                log.log(Level.WARNING, "withPlaywrightPages >> Error during Playwright task", e);
                RUNTIME.evictContextOnDriverThread(context);
                context = null;
            } finally {
                for (var page : pages) {
                    closePageQuietly(page);
                }
                if (context != null) {
                    RUNTIME.releaseContextOnDriverThread(context);
                }
            }
            return null;
        });
    }

    /**
     * Production crawl: pooled context on the driver thread, lean network, returns handler result.
     */
    public <T> T withCrawlPage(
            long timeoutMs,
            Map<String, String> extraPageHeaders,
            boolean headless,
            BiFunction<Page, Long, T> handler
    ) {
        return RUNTIME.call(() -> {
            var context = RUNTIME.acquireContextOnDriverThread(headless);
            try {
                var page = context.newPage();
                page.setDefaultTimeout(timeoutMs);
                page.setDefaultNavigationTimeout(timeoutMs);
                if (extraPageHeaders != null && !extraPageHeaders.isEmpty()) {
                    page.setExtraHTTPHeaders(extraPageHeaders);
                }
                try {
                    return handler.apply(page, timeoutMs);
                } finally {
                    closePageQuietly(page);
                }
            } catch (RuntimeException ex) {
                RUNTIME.evictContextOnDriverThread(context);
                context = null;
                throw ex;
            } catch (Exception ex) {
                RUNTIME.evictContextOnDriverThread(context);
                context = null;
                throw new IllegalStateException("Playwright crawl page task failed", ex);
            } finally {
                if (context != null) {
                    RUNTIME.releaseContextOnDriverThread(context);
                }
            }
        });
    }

    /**
     * Navigate for API capture: waits for DOMContentLoaded only (not full load / network idle).
     */
    public void navigateForApiCapture(Page page, String url, long timeoutMs) {
        page.navigate(url, new Page.NavigateOptions()
                .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                .setTimeout(timeoutMs));
    }

    public void waitDomContentLoaded(Page page) {
        page.waitForLoadState(LoadState.DOMCONTENTLOADED);
    }

    /**
     * Best-effort HTML snapshot that tolerates transient navigation.
     * Returns null when page is closed or keeps navigating across retries.
     */
    public String safePageContent(Page page) {
        if (page == null || page.isClosed()) {
            return null;
        }
        PlaywrightException lastError = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                page.waitForLoadState(
                        LoadState.DOMCONTENTLOADED,
                        new Page.WaitForLoadStateOptions().setTimeout(2_000)
                );
                return page.content();
            } catch (PlaywrightException e) {
                lastError = e;
                if (page.isClosed()) {
                    return null;
                }
                if (e.getMessage() != null && e.getMessage().contains("page is navigating")) {
                    page.waitForTimeout(250);
                    continue;
                }
                throw e;
            }
        }
        if (lastError != null) {
            log.log(Level.FINE, "safePageContent >> fallback to null after retries: {0}", lastError.getMessage());
        }
        return null;
    }

    public static boolean isRunningProd() {
        try {
            return "PROD".equalsIgnoreCase(System.getenv("ENV"));
        } catch (Exception e) {
            return false;
        }
    }

    /** Visible for tests. */
    static void shutdownRuntime() {
        RUNTIME.shutdown();
    }

    public static int contextPoolSize() {
        return PlaywrightRuntime.resolvePoolSize();
    }

    public static void bindFromProperties(PlaywrightProperties properties) {
        RUNTIME.bindProperties(properties);
    }

    /**
     * Runs action with a dedicated Playwright on the current thread (for parallel load tests).
     */
    public static <T> T runIsolated(boolean headless, Function<Page, T> action) {
        return PlaywrightRuntime.runIsolated(headless, action);
    }

    private static void closePageQuietly(Page page) {
        if (page == null || page.isClosed()) {
            return;
        }
        try {
            page.close();
        } catch (Exception ex) {
            log.log(Level.FINE, "Failed to close page: {0}", ex.getMessage());
        }
    }
}

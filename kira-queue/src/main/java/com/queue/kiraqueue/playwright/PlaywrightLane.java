package com.queue.kiraqueue.playwright;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.queue.kiraqueue.browser.AiscorePageFetchClient;
import lombok.Getter;
import lombok.extern.java.Log;

import java.util.function.Function;
import java.util.logging.Level;

import static com.queue.kiraqueue.util.PlaywrightUtil.*;

@Getter
@Log
public class PlaywrightLane {
    private final String laneType;
    private final Object lock = new Object();

    private Playwright playwright;
    private BrowserContext browserContext;
    private Page page;

    public PlaywrightLane(String laneType) {
        this.laneType = laneType;
        initBrowser();
    }

    public <T> T withPage(Function<Page, T> action) {
        synchronized (lock) {
            ensureReady();
            return action.apply(page);
        }
    }

    public void ensureReady() {
        synchronized (lock) {
            if (page != null && !page.isClosed()) {
                return;
            }
            log.log(Level.WARNING, "Playwright lane {0} page unavailable; reinitializing", laneType);
            tearDown();
            initBrowser();
        }
    }

    private void initBrowser() {
        this.playwright = Playwright.create();
        var browser = playwright.chromium().launch(launchOptions(true));
        this.browserContext = browser.newContext(contextOptions());
        this.browserContext.addInitScript(INIT_SCRIPT_STEALTH);
        this.page = browserContext.newPage();
        this.page.navigate(AiscorePageFetchClient.ORIGIN);
        log.info("Playwright lane %s ready".formatted(laneType));
    }

    private void tearDown() {
        if (page != null) {
            try {
                page.close();
            } catch (RuntimeException ignored) {
                // lane recovery
            }
            page = null;
        }
        if (browserContext != null) {
            try {
                browserContext.close();
            } catch (RuntimeException ignored) {
                // lane recovery
            }
            browserContext = null;
        }
        if (playwright != null) {
            try {
                playwright.close();
            } catch (RuntimeException ignored) {
                // lane recovery
            }
            playwright = null;
        }
    }

    public void close() {
        synchronized (lock) {
            tearDown();
        }
    }
}

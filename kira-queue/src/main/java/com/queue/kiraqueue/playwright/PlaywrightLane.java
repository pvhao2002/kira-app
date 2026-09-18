package com.queue.kiraqueue.playwright;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.WaitUntilState;
import com.queue.kiraqueue.browser.AiscorePageFetchClient;
import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.config.PlaywrightProperties;
import lombok.Getter;
import lombok.extern.java.Log;
import org.springframework.util.StringUtils;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.function.Function;
import java.util.logging.Level;

@Getter
@Log
public class PlaywrightLane {
    private final String laneType;
    private final PlaywrightProperties properties;
    private final Object lock = new Object();

    private Playwright playwright;
    private BrowserContext browserContext;
    private Page page;

    public PlaywrightLane(String laneType, PlaywrightProperties properties) {
        this.laneType = laneType;
        this.properties = properties;
        initBrowser();
    }

    public <T> T withPage(Function<Page, T> action) {
        synchronized (lock) {
            ensureReady();
            try {
                return action.apply(page);
            } catch (BusinessException ex) {
                if (ex.getMessage() != null && ex.getMessage().startsWith("AISCORE_VERIFICATION_REQUIRED")) {
                    log.warning("Cloudflare verification required for instance "
                            + properties.resolvedProfileInstanceId() + ", lane " + laneType
                            + "; keep this browser profile open for remote verification");
                }
                throw ex;
            }
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
        // A persistent user-data-dir keeps a legitimately-earned Cloudflare clearance cookie
        // (and other session state) alive across lane re-inits/restarts instead of starting
        // every crawl as a brand-new, never-seen-before client.
        var userDataDir = resolveProfileDir();
        var options = new BrowserType.LaunchPersistentContextOptions()
                .setHeadless(properties.headless());
        if (StringUtils.hasText(properties.channel())) {
            options.setChannel(properties.channel());
        }
        if (StringUtils.hasText(properties.acceptLanguage())) {
            options.setExtraHTTPHeaders(Map.of("Accept-Language", properties.acceptLanguage()));
        }
        this.browserContext = playwright.chromium().launchPersistentContext(userDataDir, options);
        this.page = browserContext.pages().isEmpty() ? browserContext.newPage() : browserContext.pages().getFirst();

        this.page.navigate(AiscorePageFetchClient.ORIGIN,
                new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED));
        log.info("Playwright lane %s opened (headless=%s, profileDir=%s); Cloudflare clearance is checked before API requests"
                .formatted(laneType, properties.headless(), userDataDir));
    }

    private Path resolveProfileDir() {
        var baseDir = StringUtils.hasText(properties.profileBaseDir()) ? properties.profileBaseDir() : ".playwright";
        return Paths.get(baseDir, properties.resolvedProfileInstanceId(), laneType);
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

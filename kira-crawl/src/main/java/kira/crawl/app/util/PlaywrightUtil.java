package kira.crawl.app.util;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.ColorScheme;
import com.microsoft.playwright.options.LoadState;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;
import org.jsoup.nodes.Element;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.logging.Level;

@Log
@UtilityClass
public class PlaywrightUtil {

    /** Upper bound for navigation (navigate, goBack, etc.) — prevents hanging on slow pages. */
    public static final int DEFAULT_NAVIGATION_TIMEOUT_MS = 120_000;
    /** Default for clicks, waitForSelector, most non-navigation actions. */
    public static final int DEFAULT_ACTION_TIMEOUT_MS = 90_000;
    /** waitForLoadState(DOM) — do not wait for full "load" (can hang on long-poll / ads). */
    public static final int DOM_CONTENT_LOADED_TIMEOUT_MS = 60_000;

    public static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private static final String LOCALE = "en-US";
    private static final String ACCEPT_LANGUAGE = "en-US,en;q=0.9,vi;q=0.8";

    private static BrowserType.LaunchOptions launchOptions(boolean headless) {
        var opts = new BrowserType.LaunchOptions()
                .setHeadless(headless)
                .setArgs(List.of(
                        "--disable-blink-features=AutomationControlled",
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--disable-infobars"
                ));
        try {
            opts.setChannel("chrome");
        } catch (Exception ignored) {
        }
        return opts;
    }

    private static Browser.NewContextOptions contextOptions() {
        return new Browser.NewContextOptions()
                .setUserAgent(USER_AGENT)
                .setLocale(LOCALE)
                .setTimezoneId("Asia/Ho_Chi_Minh")
                .setExtraHTTPHeaders(Map.of("Accept-Language", ACCEPT_LANGUAGE))
                .setIgnoreHTTPSErrors(false)
                .setColorScheme(ColorScheme.LIGHT)
                .setDeviceScaleFactor(1);
    }

    private static final String INIT_SCRIPT_STEALTH = """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = window.chrome || { runtime: {} };
            """;

    public <P> void withPlaywright(P obj, BiConsumer<Page, P> logic) {
        try (var p = Playwright.create();
             var b = p.chromium().launch(launchOptions(isRunningProd()));
             BrowserContext context = b.newContext(contextOptions())) {
            context.addInitScript(INIT_SCRIPT_STEALTH);
            Page page = context.newPage();
            applyDefaultTimeouts(page);
            logic.accept(page, obj);
        } catch (TimeoutError timeoutError) {
            log.log(Level.WARNING, "Playwright task timed out", timeoutError);
        } catch (PlaywrightException playwrightException) {
            log.log(Level.SEVERE, "Playwright error occurred", playwrightException);
        } catch (Exception e) {
            log.log(Level.WARNING, "withPlaywright >> Error during Playwright task", e);
        }
    }

    public <P> void withPlaywrightPages(int pageCount, BiConsumer<List<Page>, P> logic, P obj) {
        try (var p = Playwright.create();
             var b = p.chromium().launch(launchOptions(isRunningProd()));
             var context = b.newContext(contextOptions())) {
            context.addInitScript(INIT_SCRIPT_STEALTH);
            List<Page> pages = new ArrayList<>(pageCount);
            for (int i = 0; i < pageCount; i++) {
                Page pg = context.newPage();
                applyDefaultTimeouts(pg);
                pages.add(pg);
            }
            logic.accept(pages, obj);
        } catch (Exception e) {
            log.log(Level.WARNING, "withPlaywrightPages >> Error during Playwright task", e);
        }
    }

    public static void applyDefaultTimeouts(Page page) {
        page.setDefaultNavigationTimeout(DEFAULT_NAVIGATION_TIMEOUT_MS);
        page.setDefaultTimeout(DEFAULT_ACTION_TIMEOUT_MS);
    }

    /** Prefer DOMContentLoaded with cap — full LoadState.LOAD can stall indefinitely. */
    public void waitDomContentLoaded(Page page) {
        page.waitForLoadState(LoadState.DOMCONTENTLOADED,
                new Page.WaitForLoadStateOptions().setTimeout(DOM_CONTENT_LOADED_TIMEOUT_MS));
    }

    /**
     * Dismiss cookie / accept banner if present. No-op when the close icon is absent (avoids 30s default click timeout).
     */
    public void removeAcceptAll(Page page) {
        try {
            page.locator(".van-icon-cross").first()
                    .click(new Locator.ClickOptions().setTimeout(2_500));
        } catch (PlaywrightException e) {
            log.log(Level.FINE, "Accept banner not dismissed (no .van-icon-cross or not clickable): {0}", e.getMessage());
        }
    }

    public String getImageFromStyleBackgroundImage(Page page, String selector) {
        return (String) page.evaluate("""
                    (selector) => {
                        const el = document.querySelector(selector);
                        if (!el) return null;
                        const bg = getComputedStyle(el).backgroundImage;
                        return bg?.replace(/^url\\(["']?/, '').replace(/["']?\\)$/, '');
                    }
                """, selector);
    }

    public String getImageFromImgSrc(Element root, String selector) {
        if (root == null) return null;
        var img = root.selectFirst(selector);
        if (img == null) return null;
        String src = img.attr("abs:src");
        return src.isBlank() ? null : src.trim();
    }

    public static boolean isRunningProd() {
        try {
            return "PROD".equalsIgnoreCase(System.getenv("ENV"));
        } catch (Exception e) {
            return false;
        }
    }
}

package com.queue.kiraqueue.util;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.ColorScheme;
import com.microsoft.playwright.options.LoadState;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.logging.Level;

@Log
@UtilityClass
public class PlaywrightUtil {
    /**
     * Chrome trên Windows, phiên bản mới — giống user thật.
     */
    public static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private static final int VIEWPORT_WIDTH = 1920;
    private static final int VIEWPORT_HEIGHT = 1080;
    private static final String LOCALE = "en-US";
    private static final String ACCEPT_LANGUAGE = "en-US,en;q=0.9,vi;q=0.8";

    /**
     * Launch options giống trình duyệt thật: tắt cờ automation, dùng Chrome nếu có.
     */
    private static BrowserType.LaunchOptions launchOptions(boolean headless) {
        var opts = new BrowserType.LaunchOptions()
                .setHeadless(headless)
                .setArgs(List.of(
                        "--disable-blink-features=AutomationControlled",
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--disable-infobars",
                        "--window-size=%d,%d".formatted(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
                ));
        try {
            opts.setChannel("chrome");
        } catch (Exception ignored) {
            // Chrome chưa cài, dùng Chromium mặc định
        }
        return opts;
    }

    /**
     * Context options giống user thật: viewport, locale, timezone.
     */
    private static Browser.NewContextOptions contextOptions() {
        return new Browser.NewContextOptions()
                .setUserAgent(USER_AGENT)
                .setViewportSize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
                .setLocale(LOCALE)
                .setTimezoneId("Asia/Ho_Chi_Minh")
                .setExtraHTTPHeaders(Map.of("Accept-Language", ACCEPT_LANGUAGE))
                .setIgnoreHTTPSErrors(false)
                .setColorScheme(ColorScheme.LIGHT)
                .setDeviceScaleFactor(1);
    }

    /**
     * Script chạy trước mỗi page: giảm phát hiện automation.
     */
    private static final String INIT_SCRIPT_STEALTH = """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = window.chrome || { runtime: {} };
            """;

    public <P> void withPlaywright(P obj, BiConsumer<Page, P> logic) {
        withPlaywright(obj, logic, null);
    }

    public <P> void withPlaywright(P obj, BiConsumer<Page, P> logic, Consumer<Exception> errorHandler) {
        try (
                var p = Playwright.create();
                var b = p.chromium().launch(launchOptions(true));
                BrowserContext context = b.newContext(contextOptions())) {
            context.addInitScript(INIT_SCRIPT_STEALTH);
            Page page = context.newPage();
            logic.accept(page, obj);
        } catch (Exception e) {
            log.log(Level.WARNING, "withPlaywright >> Error during Playwright task", e);
            if (errorHandler != null) {
                errorHandler.accept(e);
            }
        }
    }

    public <P> void withPlaywrightPages(int pageCount, BiConsumer<List<Page>, P> logic, P obj) {
        try (var p = Playwright.create();
             var b = p.chromium().launch(launchOptions(isRunningProd()));
             var context = b.newContext(contextOptions())) {
            context.addInitScript(INIT_SCRIPT_STEALTH);

            List<Page> pages = new ArrayList<>(pageCount);
            for (int i = 0; i < pageCount; i++) {
                pages.add(context.newPage());
            }

            logic.accept(pages, obj);

        } catch (Exception e) {
            log.log(Level.WARNING, "withPlaywrightPages >> Error during Playwright task", e);
        }
    }


    public void waitDomContentLoaded(Page page) {
        page.waitForLoadState();
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
                // Common transient failure when reading content mid-navigation.
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

    /**
     * Đóng banner cookie / accept nếu có. Best-effort: không ném lỗi khi không có icon,
     * page đã đóng, hoặc click đua với navigation (TargetClosedError).
     */
    public void removeAcceptAll(Page page) {
        if (page == null) {
            return;
        }
        try {
            if (page.isClosed()) {
                return;
            }
            page.locator(".van-icon-cross").first().click();
        } catch (PlaywrightException e) {
            log.log(Level.FINE, "Accept banner not dismissed (no .van-icon-cross or page gone): {0}", e.getMessage());
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

    public String getImageFromImgSrc(org.jsoup.nodes.Element root, String selector) {
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

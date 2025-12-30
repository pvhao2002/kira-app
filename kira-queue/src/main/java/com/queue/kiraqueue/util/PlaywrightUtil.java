package com.queue.kiraqueue.util;

import com.microsoft.playwright.*;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;

import java.util.function.BiConsumer;
import java.util.logging.Level;

@Log
@UtilityClass
public class PlaywrightUtil {
    public static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
    public static final String CRAWL_DATE = "CRAWL_DATE";
    public static final String CRAWL_TOMORROW_DATE = "CRAWL_TOMORROW_DATE";
    public static final String CRAWL_EVENT = "CRAWL_EVENT";
    public static final String CRAWL_UPCOMING_EVENT = "CRAWL_UPCOMING_EVENT";

    public <P> void withPlaywright(P obj, BiConsumer<Page, P> logic) {
        try (
                var p = Playwright.create();
                var b = p.chromium().launch(new BrowserType.LaunchOptions().setHeadless(isRunningProd()));
                BrowserContext context = b.newContext(
                        new Browser.NewContextOptions()
                                .setUserAgent(USER_AGENT)
                                .setTimezoneId("Asia/Ho_Chi_Minh"));
                Page page = context.newPage()) {
            logic.accept(page, obj);
        } catch (TimeoutError timeoutError) {
            log.log(Level.WARNING, "Playwright task timed out", timeoutError);
        } catch (PlaywrightException playwrightException) {
            log.log(Level.SEVERE, "Playwright error occurred", playwrightException);
        } catch (Exception e) {
            log.log(Level.WARNING, "Error during Playwright task", e);
        }
    }

    public static boolean isRunningProd() {
        try {
            return "PROD".equalsIgnoreCase(System.getenv("ENV"));
        } catch (Exception e) {
            return false;
        }
    }
}

package com.queue.kiraqueue.util;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;
import org.jsoup.nodes.Element;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.logging.Level;

@Log
@UtilityClass
public class PlaywrightUtil {
    public static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

    public <P> void withPlaywright(P obj, BiConsumer<Page, P> logic) {
        try (
                var p = Playwright.create();
                var b = p.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
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
            log.log(Level.WARNING, "withPlaywright >> Error during Playwright task", e);
        }
    }

    public <P> void withPlaywrightPages(int pageCount, BiConsumer<List<Page>, P> logic, P obj) {
        try (var p = Playwright.create();
             var b = p.chromium().launch(new BrowserType.LaunchOptions().setHeadless(isRunningProd()));
             var context = b.newContext(new Browser.NewContextOptions().setUserAgent(USER_AGENT).setTimezoneId("Asia/Ho_Chi_Minh"))) {

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

    public void removeAcceptAll(Page page) {
        var selector = ".van-icon-cross";
        page.locator(selector).click();
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

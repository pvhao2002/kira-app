package kira.crawl.browser;

import com.microsoft.playwright.Page;

public final class CloudflareSupport {

    private CloudflareSupport() {
    }

    public static void waitForClearance(Page page, long timeoutMs) {
        var deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            var title = safeTitle(page);
            var bodyText = safeBodyText(page);
            var isChallenge = title.contains("Just a moment") || bodyText.contains("Just a moment");
            if (!isChallenge) {
                return;
            }
            page.waitForTimeout(2000);
        }
    }

    private static String safeTitle(Page page) {
        try {
            return page.title();
        } catch (RuntimeException ex) {
            return "";
        }
    }

    private static String safeBodyText(Page page) {
        try {
            return page.locator("body").innerText(new com.microsoft.playwright.Locator.InnerTextOptions().setTimeout(1000));
        } catch (RuntimeException ex) {
            return "";
        }
    }
}

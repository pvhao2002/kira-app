package com.queue.kiraqueue.util;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.LoadState;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;

import java.util.logging.Level;

@Log
@UtilityClass
public class PlaywrightUtil {
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

    public String getImageFromImgSrc(org.jsoup.nodes.Element root, String selector) {
        if (root == null) return null;

        var img = root.selectFirst(selector);
        if (img == null) return null;

        String src = img.attr("abs:src");
        return src.isBlank() ? null : src.trim();
    }

}

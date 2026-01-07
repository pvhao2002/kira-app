package app.auto.be.kiratoolservice.util;

import com.microsoft.playwright.Page;
import lombok.experimental.UtilityClass;

@UtilityClass
public class ScribdUtil {

    public void scrollToEnd(Page page) {
        var totalPage = (Number) page.evaluate("() => docManager._pageCount");
        var currentPage = 1;
        while (currentPage < totalPage.intValue()) {
            page.evaluate("() => docManager.gotoNextPage()");
            page.waitForTimeout(500);
            currentPage++;
        }
    }

    public void scrollUntilNoMovement(Page page) {
        int stable = 0;
        double lastScrollTop = 0;

        while (stable < 5) {
            page.mouse().wheel(0, 1500);
            page.waitForTimeout(800);

            Number scrollTop = (Number) page.evaluate("() => window.scrollY");
            double currentScrollTop = scrollTop.doubleValue();

            if (Math.abs(currentScrollTop - lastScrollTop) < 5) {
                stable++;
            } else {
                stable = 0;
                lastScrollTop = currentScrollTop;
            }
        }
    }

    public void removeScribdOverlays(Page page) {
        page.evaluate("""
                    () => {
                        document.querySelectorAll('.document_scroller').forEach(el => { el.className = ''; });
                        const classes = [
                            'toolbar_drop',
                            'mobile_overlay'
                        ];
                
                        classes.forEach(cls => {
                            document.querySelectorAll('.' + cls).forEach(el => { el.remove(); });
                        });
                    }
                """);
    }

    public void waitForImages(Page page) {
        page.evaluate("""
                    async () => {
                        const images = Array.from(document.images);
                        await Promise.all(
                            images.map(img =>
                                img.complete
                                    ? Promise.resolve()
                                    : new Promise(res => img.onload = res)
                            )
                        );
                    }
                """);
    }


    public String buildEmbedUrl(String url) {
        return url
                .replace("/document/", "/embeds/")
                .replaceAll("/[^/]+$", "/content");
    }

    public String extractDocumentName(String url) {
        String[] parts = url.split("/");
        return parts[parts.length - 1];
    }
}

package app.auto.be.kiratoolservice.util;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.Margin;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;

import java.util.List;

@Log
@UtilityClass
public class GoogleDriveUtil {

    public void scrollToLoadAllPages(Page page) {
        // Find the deepest scrollable container (Drive PDF viewer).
        page.evaluate("""
                () => {
                    let best = null, maxSH = 0;
                    for (const d of document.querySelectorAll('div')) {
                        const ov = getComputedStyle(d).overflowY;
                        if (['auto','scroll','overlay'].includes(ov)
                                && d.scrollHeight > d.clientHeight + 100
                                && d.scrollHeight > maxSH) {
                            maxSH = d.scrollHeight;
                            best = d;
                        }
                    }
                    window.__sc = best;
                }
                """);

        // Click the viewer center so wheel events reach the right container.
        Object coords = page.evaluate("""
                () => {
                    const el = window.__sc;
                    if (el) {
                        const r = el.getBoundingClientRect();
                        return [r.x + r.width / 2, r.y + r.height / 2];
                    }
                    return [window.innerWidth / 2, window.innerHeight / 2];
                }
                """);

        if (coords instanceof List<?> xy && xy.size() == 2) {
            double cx = ((Number) xy.get(0)).doubleValue();
            double cy = ((Number) xy.get(1)).doubleValue();
            page.mouse().click(cx, cy);
            page.waitForTimeout(300);
        }

        int stableCount = 0;
        double lastScrollPos = 0;

        while (stableCount < 8) {
            page.mouse().wheel(0, 1200);
            page.waitForTimeout(1000);

            Number scrollPos = (Number) page.evaluate(
                    "() => window.__sc?.scrollTop ?? document.scrollingElement?.scrollTop ?? window.scrollY"
            );
            double current = scrollPos.doubleValue();

            if (Math.abs(current - lastScrollPos) < 5) {
                stableCount++;
            } else {
                stableCount = 0;
                lastScrollPos = current;
            }
        }
    }

    /**
     * Blob URLs from Drive cannot be fetched directly (restricted origin),
     * but can be rendered via <img>. We draw each rendered img onto a canvas
     * and export as JPEG data URI — same-origin canvas access is allowed.
     */
    public List<String> fetchBlobImagesAsBase64(Page page) {
        Object result = page.evaluate("""
                async () => {
                    const imgs = Array.from(
                        document.querySelectorAll('img[src^="blob:https://drive.google.com/"]')
                    );

                    const results = [];
                    for (const img of imgs) {
                        try {
                            // Ensure the image is fully loaded before drawing.
                            if (!img.complete || img.naturalWidth === 0) {
                                await new Promise((resolve, reject) => {
                                    img.onload  = resolve;
                                    img.onerror = reject;
                                    setTimeout(resolve, 8000);
                                });
                            }
                            if (img.naturalWidth === 0) continue;

                            const canvas = document.createElement('canvas');
                            canvas.width  = img.naturalWidth;
                            canvas.height = img.naturalHeight;
                            canvas.getContext('2d').drawImage(img, 0, 0);
                            results.push(canvas.toDataURL('image/jpeg', 0.92));
                        } catch (e) {
                            // skip unreadable image
                        }
                    }
                    return results;
                }
                """);

        if (result instanceof List<?> list) {
            var images = list.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .filter(s -> s.startsWith("data:image/"))
                    .toList();
            log.info("Canvas-extracted " + images.size() + " Drive page images");
            return images;
        }
        return List.of();
    }

    public byte[] buildPdfFromImages(Page drivePage, List<String> base64Images) {
        var html = new StringBuilder();
        html.append("""
                <!DOCTYPE html><html><head><style>
                    @page { margin: 0; size: A4 portrait; }
                    html, body { margin: 0; padding: 0; background: white; }
                    .page {
                        width: 210mm;
                        height: 297mm;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        page-break-after: always;
                        page-break-inside: avoid;
                    }
                    .page:last-child { page-break-after: auto; }
                    .page img { width: 100%; height: 100%; object-fit: contain; display: block; }
                </style></head><body>
                """);

        for (var imgData : base64Images) {
            html.append("<div class=\"page\"><img src=\"").append(imgData).append("\"></div>");
        }
        html.append("</body></html>");

        // Open a fresh page (about:blank by default) so Drive's Trusted-Types CSP
        // does not block setContent, and page.navigate("about:blank") is never needed.
        var pdfPage = drivePage.context().newPage();
        try {
            pdfPage.setContent(html.toString());
            pdfPage.waitForLoadState();
            pdfPage.evaluate("""
                    async () => {
                        await Promise.all(Array.from(document.images).map(img => {
                            if (img.complete) return;
                            return new Promise(r => { img.onload = r; img.onerror = r; });
                        }));
                    }
                    """);
            return pdfPage.pdf(new Page.PdfOptions()
                    .setFormat("A4")
                    .setPrintBackground(true)
                    .setMargin(new Margin()
                            .setTop("0mm")
                            .setBottom("0mm")
                            .setLeft("0mm")
                            .setRight("0mm"))
            );
        } finally {
            pdfPage.close();
        }
    }

    public String extractTitle(Page page) {
        var title = (String) page.evaluate("() => document.title");
        if (title == null || title.isBlank()) return "drive_document";
        return title
                .replace(" - Google Drive", "")
                .replace(".pdf", "")
                .trim();
    }
}

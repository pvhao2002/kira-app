package com.kira.news.seo;

import com.kira.news.article.ArticleRepository;
import com.kira.news.article.ArticleRows.FeedRow;
import com.kira.news.category.CategoryRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/** Crawler files. The SSR server proxies these paths so they live on the public site origin. */
@RestController
@Transactional(readOnly = true)
public class SeoController {
    private static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic();
    private static final MediaType XML = MediaType.parseMediaType("application/xml;charset=UTF-8");

    private final ArticleRepository articles;
    private final CategoryRepository categories;
    private final String siteUrl;
    private final String siteName;

    public SeoController(ArticleRepository articles, CategoryRepository categories,
                         @Value("${news.site-url}") String siteUrl, @Value("${news.site-name}") String siteName) {
        this.articles = articles;
        this.categories = categories;
        this.siteUrl = siteUrl.replaceAll("/+$", "");
        this.siteName = siteName;
    }

    @GetMapping(path = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> robots() {
        var body = """
                User-agent: *
                Allow: /
                Disallow: /admin
                Disallow: /api/

                Sitemap: %1$s/sitemap.xml
                Sitemap: %1$s/news-sitemap.xml
                """.formatted(siteUrl);
        return ResponseEntity.ok().cacheControl(CACHE).body(body);
    }

    @GetMapping("/sitemap.xml")
    public ResponseEntity<String> sitemap() {
        var xml = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                """);
        url(xml, siteUrl + "/", null, "hourly");
        categories.findAllByOrderBySortOrderAscNameAsc()
                .forEach(category -> url(xml, siteUrl + "/chuyen-muc/" + category.getSlug(), null, "hourly"));
        // shortcut: one file capped at 45k URLs; split into a sitemap index past that.
        articles.findFeed(Instant.EPOCH, PageRequest.of(0, 45_000))
                .forEach(row -> url(xml, articleUrl(row), row.updatedAt(), "weekly"));
        xml.append("</urlset>\n");
        return ResponseEntity.ok().contentType(XML).cacheControl(CACHE).body(xml.toString());
    }

    /** Google News sitemap: only articles published in the last 48 hours. */
    @GetMapping("/news-sitemap.xml")
    public ResponseEntity<String> newsSitemap() {
        var xml = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
                """);
        for (var row : articles.findFeed(Instant.now().minus(Duration.ofHours(48)), PageRequest.of(0, 1000))) {
            xml.append("  <url>\n    <loc>").append(escape(articleUrl(row))).append("</loc>\n")
                    .append("    <news:news>\n      <news:publication><news:name>").append(escape(siteName))
                    .append("</news:name><news:language>vi</news:language></news:publication>\n")
                    .append("      <news:publication_date>").append(iso(row.publishedAt())).append("</news:publication_date>\n")
                    .append("      <news:title>").append(escape(row.title())).append("</news:title>\n")
                    .append("    </news:news>\n  </url>\n");
        }
        xml.append("</urlset>\n");
        return ResponseEntity.ok().contentType(XML).cacheControl(CACHE).body(xml.toString());
    }

    @GetMapping("/rss.xml")
    public ResponseEntity<String> rss() {
        var xml = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0"><channel>
                """);
        xml.append("<title>").append(escape(siteName)).append("</title><link>").append(escape(siteUrl))
                .append("/</link><description>Tin tức 24/7</description><language>vi</language>\n");
        for (var row : articles.findFeed(Instant.EPOCH, PageRequest.of(0, 50))) {
            xml.append("<item><title>").append(escape(row.title())).append("</title><link>").append(escape(articleUrl(row)))
                    .append("</link><guid>").append(escape(articleUrl(row))).append("</guid><category>")
                    .append(escape(row.categoryName())).append("</category><pubDate>")
                    .append(DateTimeFormatter.RFC_1123_DATE_TIME.format(row.publishedAt().atOffset(ZoneOffset.UTC)))
                    .append("</pubDate><description>").append(escape(row.summary() == null ? "" : row.summary()))
                    .append("</description></item>\n");
        }
        xml.append("</channel></rss>\n");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/rss+xml;charset=UTF-8"))
                .cacheControl(CACHE).body(xml.toString());
    }

    private String articleUrl(FeedRow row) {
        return siteUrl + "/tin/" + row.slug();
    }

    private static void url(StringBuilder xml, String loc, Instant lastModified, String changeFrequency) {
        xml.append("  <url><loc>").append(escape(loc)).append("</loc>");
        if (lastModified != null) {
            xml.append("<lastmod>").append(iso(lastModified)).append("</lastmod>");
        }
        xml.append("<changefreq>").append(changeFrequency).append("</changefreq></url>\n");
    }

    private static String iso(Instant instant) {
        return DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(instant.atOffset(ZoneOffset.UTC));
    }

    static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}

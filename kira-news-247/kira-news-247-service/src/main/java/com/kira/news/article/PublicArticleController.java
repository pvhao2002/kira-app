package com.kira.news.article;

import com.kira.news.article.ArticleRows.CardRow;
import com.kira.news.category.Category;
import com.kira.news.category.CategoryRepository;
import com.kira.news.proto.v1.*;
import com.kira.news.shared.ApiException;
import com.kira.news.shared.Protobuf;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

import static com.kira.news.shared.Protobuf.millis;
import static com.kira.news.shared.Protobuf.text;

/** Read-only endpoints rendered by the SSR server for readers and crawlers. */
@RestController
@RequestMapping(path = "/api/v1/public", produces = Protobuf.CONTENT_TYPE)
@Transactional(readOnly = true)
public class PublicArticleController {
    private static final CacheControl SHORT = CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic();

    private final ArticleRepository articles;
    private final CategoryRepository categories;

    public PublicArticleController(ArticleRepository articles, CategoryRepository categories) {
        this.articles = articles;
        this.categories = categories;
    }

    @GetMapping("/home")
    public ResponseEntity<HomePage> home() {
        var front = articles.findPublished(PageRequest.of(0, 13)).getContent();
        var home = HomePage.newBuilder();
        if (!front.isEmpty()) {
            home.setLead(front.getFirst().toProto());
        }
        home.addAllTop(cards(front.stream().skip(1).limit(4).toList()))
                .addAllLatest(cards(front.stream().skip(5).toList()))
                .addAllMostRead(cards(articles.findMostRead(Instant.now().minus(Duration.ofDays(7)), PageRequest.of(0, 5))));
        for (Category category : categories.findAllByOrderBySortOrderAscNameAsc()) {
            var items = articles.findPublishedByCategory(category.getId(), PageRequest.of(0, 4)).getContent();
            if (!items.isEmpty()) {
                home.addSections(CategorySection.newBuilder().setCategory(category.toProto()).addAllItems(cards(items)));
            }
        }
        return ResponseEntity.ok().cacheControl(SHORT).body(home.build());
    }

    @GetMapping("/articles")
    public ResponseEntity<ArticlePage> list(@RequestParam(defaultValue = "") String category,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "12") int size) {
        var pageable = pageable(page, size);
        var result = category.isBlank()
                ? articles.findPublished(pageable)
                : articles.findPublishedByCategory(categories.findBySlug(category)
                .orElseThrow(() -> ApiException.notFound("CATEGORY_NOT_FOUND", "Không tìm thấy chuyên mục.")).getId(), pageable);
        return ResponseEntity.ok().cacheControl(SHORT).body(page(result));
    }

    @GetMapping("/search")
    public ArticlePage search(@RequestParam String q,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "12") int size) {
        var term = q.strip();
        ApiException.require(term.length() >= 2 && term.length() <= 100, "INVALID_QUERY", "Từ khóa 2-100 ký tự.");
        return page(articles.searchPublished("%" + term.toLowerCase(Locale.ROOT) + "%", pageable(page, size)));
    }

    @GetMapping("/articles/{slug}")
    public ResponseEntity<ArticleDetail> detail(@PathVariable String slug) {
        var article = articles.findBySlugAndStatus(slug, ArticleStatus.PUBLISHED)
                .orElseThrow(() -> ApiException.notFound("ARTICLE_NOT_FOUND", "Không tìm thấy bài viết."));
        var category = article.getCategory();
        var card = new CardRow(article.getId(), article.getSlug(), article.getTitle(), article.getSummary(),
                article.getCoverImageUrl(), article.getPublishedAt(), article.getReadingMinutes(),
                category.getId(), category.getSlug(), category.getName());
        var detail = ArticleDetail.newBuilder()
                .setCard(card.toProto())
                .setBodyHtml(article.getBodyHtml())
                .addAllTags(article.getTags())
                .addAllSourceUrls(article.getSourceUrls())
                .setAuthorName("Kira News 247")
                .setUpdatedAt(millis(article.getUpdatedAt()))
                .setViewCount(article.getViewCount())
                .addAllRelated(cards(articles.findRelated(category.getId(), article.getId(), PageRequest.of(0, 4))))
                .build();
        return ResponseEntity.ok().cacheControl(SHORT).body(detail);
    }

    private static Pageable pageable(int page, int size) {
        return PageRequest.of(Math.clamp(page, 0, 1000), Math.clamp(size, 1, 48));
    }

    private static List<ArticleCard> cards(List<CardRow> rows) {
        return rows.stream().map(CardRow::toProto).toList();
    }

    private static ArticlePage page(Page<CardRow> result) {
        return ArticlePage.newBuilder()
                .addAllItems(cards(result.getContent()))
                .setTotal(result.getTotalElements())
                .setPage(result.getNumber())
                .setSize(result.getSize())
                .build();
    }

}

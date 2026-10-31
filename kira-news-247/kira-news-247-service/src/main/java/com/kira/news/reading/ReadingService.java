package com.kira.news.reading;

import com.kira.news.article.ArticleRepository;
import com.kira.news.article.ArticleRows;
import com.kira.news.article.ArticleStatus;
import com.kira.news.proto.v1.*;
import com.kira.news.shared.ApiException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.regex.Pattern;

@Service
public class ReadingService {
    static final ZoneId NEWSROOM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Pattern CLIENT_ID = Pattern.compile("[A-Za-z0-9-]{8,64}");
    /** A visitor re-opening the same article within this window does not count as a new view. */
    private static final Duration VIEW_DEDUP = Duration.ofMinutes(30);

    private final ReadEventRepository reads;
    private final ArticleRepository articles;

    public ReadingService(ReadEventRepository reads, ArticleRepository articles) {
        this.reads = reads;
        this.articles = articles;
    }

    @Transactional
    public void record(com.kira.news.proto.v1.ReadEvent event, String remoteIp, String userAgent) {
        var articleId = event.getArticleId();
        if (!articles.existsByIdAndStatus(articleId, ArticleStatus.PUBLISHED)) {
            throw ApiException.notFound("ARTICLE_NOT_FOUND", "Không tìm thấy bài viết.");
        }
        var visitorId = clientId(event.getVisitorId());
        var repeat = visitorId != null && reads.existsByArticleIdAndVisitorIdAndReadAtAfter(
                articleId, visitorId, Instant.now().minus(VIEW_DEDUP));
        reads.save(new ReadEvent(articleId, visitorId, clientId(event.getSessionId()), event.getIpInfo(),
                remoteIp, userAgent, event.getReferrer(), event.getLanguage(), event.getScreenWidth(), event.getScreenHeight()));
        if (!repeat) {
            articles.incrementViews(articleId);
        }
    }

    @Transactional(readOnly = true)
    public ReadPage page(int page, int size) {
        var result = reads.findViews(PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100)));
        return ReadPage.newBuilder()
                .addAllItems(result.getContent().stream()
                        .map(view -> view.event().toProto(view.title(), view.slug())).toList())
                .setTotal(result.getTotalElements())
                .setPage(result.getNumber())
                .setSize(result.getSize())
                .build();
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard() {
        var today = LocalDate.now(NEWSROOM_ZONE);
        var startOfToday = today.atStartOfDay(NEWSROOM_ZONE).toInstant();
        var sevenDaysAgo = today.minusDays(6).atStartOfDay(NEWSROOM_ZONE).toInstant();
        return Dashboard.newBuilder()
                .addAllStatusCounts(articles.countByStatus().stream().map(ArticleRows.StatusTotal::toProto).toList())
                .setReadsToday(reads.countByReadAtGreaterThanEqual(startOfToday))
                .setReads7D(reads.countByReadAtGreaterThanEqual(sevenDaysAgo))
                .setVisitors7D(reads.countVisitorsSince(sevenDaysAgo))
                .addAllReadsByDay(reads.countByDay(sevenDaysAgo).stream()
                        .map(row -> DayCount.newBuilder().setDay((String) row[0]).setCount(((Number) row[1]).longValue()).build())
                        .toList())
                .addAllTopCountries(reads.topCountries(sevenDaysAgo, PageRequest.of(0, 8)).stream()
                        .map(total -> CountryCount.newBuilder().setCountry(total.country()).setCount(total.count()).build())
                        .toList())
                .addAllTopArticles(articles.findTopViewed(PageRequest.of(0, 5)).stream()
                        .map(ArticleRows.AdminRow::toProto).toList())
                .addAllWaitingReview(articles.findAdminRows(ArticleStatus.IN_REVIEW, null, PageRequest.of(0, 10))
                        .getContent().stream().map(ArticleRows.AdminRow::toProto).toList())
                .build();
    }

    private static String clientId(String value) {
        return CLIENT_ID.matcher(value).matches() ? value : null;
    }
}

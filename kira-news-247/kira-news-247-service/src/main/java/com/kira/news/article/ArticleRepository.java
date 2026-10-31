package com.kira.news.article;

import com.kira.news.article.ArticleRows.AdminRow;
import com.kira.news.article.ArticleRows.CardRow;
import com.kira.news.article.ArticleRows.FeedRow;
import com.kira.news.article.ArticleRows.StatusTotal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ArticleRepository extends JpaRepository<Article, Long> {
    String CARD = "select new com.kira.news.article.ArticleRows$CardRow(a.id, a.slug, a.title, a.summary, a.coverImageUrl,"
            + " a.publishedAt, a.readingMinutes, c.id, c.slug, c.name) from Article a join a.category c"
            + " where a.status = com.kira.news.article.ArticleStatus.PUBLISHED";
    String PUBLISHED_COUNT = "select count(a) from Article a where a.status = com.kira.news.article.ArticleStatus.PUBLISHED";

    @Query(value = CARD + " order by a.publishedAt desc", countQuery = PUBLISHED_COUNT)
    Page<CardRow> findPublished(Pageable page);

    @Query(value = CARD + " and c.id = :categoryId order by a.publishedAt desc",
            countQuery = PUBLISHED_COUNT + " and a.category.id = :categoryId")
    Page<CardRow> findPublishedByCategory(@Param("categoryId") long categoryId, Pageable page);

    @Query(value = CARD + " and (lower(a.title) like :pattern or lower(a.summary) like :pattern) order by a.publishedAt desc",
            countQuery = PUBLISHED_COUNT + " and (lower(a.title) like :pattern or lower(a.summary) like :pattern)")
    Page<CardRow> searchPublished(@Param("pattern") String lowerLikePattern, Pageable page);

    @Query(CARD + " and a.publishedAt >= :since order by a.viewCount desc, a.publishedAt desc")
    List<CardRow> findMostRead(@Param("since") Instant since, Pageable page);

    @Query(CARD + " and c.id = :categoryId and a.id <> :excludeId order by a.publishedAt desc")
    List<CardRow> findRelated(@Param("categoryId") long categoryId, @Param("excludeId") long excludeId, Pageable page);

    @EntityGraph(attributePaths = "category")
    Optional<Article> findBySlugAndStatus(String slug, ArticleStatus status);

    @EntityGraph(attributePaths = "category")
    Optional<Article> findWithCategoryById(long id);

    @Query(value = """
            select new com.kira.news.article.ArticleRows$AdminRow(a.id, a.slug, a.title, a.status, c.name, a.createdBy,
                a.revision, a.updatedAt, a.publishedAt, a.viewCount,
                (select count(rc) from ReviewComment rc where rc.articleId = a.id and rc.resolvedAt is null))
            from Article a join a.category c
            where (:status is null or a.status = :status) and (:pattern is null or lower(a.title) like :pattern)
            order by a.updatedAt desc""",
            countQuery = """
                    select count(a) from Article a
                    where (:status is null or a.status = :status) and (:pattern is null or lower(a.title) like :pattern)""")
    Page<AdminRow> findAdminRows(@Param("status") ArticleStatus status, @Param("pattern") String lowerLikePattern,
                                 Pageable page);

    @Query("""
            select new com.kira.news.article.ArticleRows$AdminRow(a.id, a.slug, a.title, a.status, c.name, a.createdBy,
                a.revision, a.updatedAt, a.publishedAt, a.viewCount, 0L)
            from Article a join a.category c
            where a.status = com.kira.news.article.ArticleStatus.PUBLISHED
            order by a.viewCount desc""")
    List<AdminRow> findTopViewed(Pageable page);

    @Query("""
            select new com.kira.news.article.ArticleRows$StatusTotal(a.status, count(a))
            from Article a group by a.status""")
    List<StatusTotal> countByStatus();

    @Query("""
            select new com.kira.news.article.ArticleRows$FeedRow(a.slug, a.title, a.summary, a.publishedAt, a.updatedAt, c.name)
            from Article a join a.category c
            where a.status = com.kira.news.article.ArticleStatus.PUBLISHED and a.publishedAt >= :since
            order by a.publishedAt desc""")
    List<FeedRow> findFeed(@Param("since") Instant since, Pageable page);

    boolean existsBySlugAndIdNot(String slug, long id);

    boolean existsByIdAndStatus(long id, ArticleStatus status);

    @Modifying
    @Query("update Article a set a.viewCount = a.viewCount + 1 where a.id = :id")
    int incrementViews(@Param("id") long id);
}

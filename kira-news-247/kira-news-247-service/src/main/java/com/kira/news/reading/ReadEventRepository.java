package com.kira.news.reading;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ReadEventRepository extends JpaRepository<ReadEvent, Long> {
    record ReadView(ReadEvent event, String title, String slug) {
    }

    record CountryTotal(String country, long count) {
    }

    boolean existsByArticleIdAndVisitorIdAndReadAtAfter(long articleId, String visitorId, Instant after);

    long countByReadAtGreaterThanEqual(Instant since);

    @Query("select count(distinct r.visitorId) from ReadEvent r where r.readAt >= :since")
    long countVisitorsSince(@Param("since") Instant since);

    @Query(value = """
            select new com.kira.news.reading.ReadEventRepository$ReadView(r, a.title, a.slug)
            from ReadEvent r, com.kira.news.article.Article a where a.id = r.articleId order by r.readAt desc""",
            countQuery = "select count(r) from ReadEvent r")
    Page<ReadView> findViews(Pageable page);

    @Query("""
            select new com.kira.news.reading.ReadEventRepository$CountryTotal(coalesce(r.country, '?'), count(r))
            from ReadEvent r where r.readAt >= :since group by r.country order by count(r) desc""")
    List<CountryTotal> topCountries(@Param("since") Instant since, Pageable page);

    /** [day yyyy-MM-dd in Vietnam time, count]. */
    @Query(nativeQuery = true, value = """
            SELECT TO_CHAR(CAST(read_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE), 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
            FROM read_event WHERE read_at >= :since
            GROUP BY TO_CHAR(CAST(read_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE), 'YYYY-MM-DD')
            ORDER BY day""")
    List<Object[]> countByDay(@Param("since") Instant since);
}

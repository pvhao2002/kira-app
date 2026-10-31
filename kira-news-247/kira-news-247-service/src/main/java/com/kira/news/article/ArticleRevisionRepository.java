package com.kira.news.article;

import com.kira.news.article.ArticleRows.RevisionRow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ArticleRevisionRepository extends JpaRepository<ArticleRevision, Long> {
    Optional<ArticleRevision> findByArticleIdAndRevision(long articleId, int revision);

    @Query("""
            select new com.kira.news.article.ArticleRows$RevisionRow(r.revision, r.editedBy, r.createdAt)
            from ArticleRevision r where r.articleId = :articleId order by r.revision desc""")
    List<RevisionRow> findSummaries(@Param("articleId") long articleId);
}

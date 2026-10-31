package com.kira.news.article;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReviewCommentRepository extends JpaRepository<ReviewComment, Long> {
    List<ReviewComment> findByArticleIdOrderByCreatedAtAsc(long articleId);

    Optional<ReviewComment> findByIdAndArticleId(long id, long articleId);

    long countByArticleIdAndResolvedAtIsNull(long articleId);
}

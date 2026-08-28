package com.kira.bank.tutoring.infrastructure;

import com.kira.bank.tutoring.domain.TutoringLessonException;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.*;

public interface TutoringLessonExceptionRepository extends JpaRepository<TutoringLessonException, Long> {
    List<TutoringLessonException> findBySeriesIdInAndOccurrenceDateBetweenAndDeletedAtIsNull(
        Collection<Long> seriesIds, LocalDate from, LocalDate to);
    Optional<TutoringLessonException> findBySeriesIdAndOccurrenceDate(Long seriesId, LocalDate occurrenceDate);
    List<TutoringLessonException> findBySeriesIdAndOccurrenceDateGreaterThanEqualAndDeletedAtIsNull(
        Long seriesId, LocalDate occurrenceDate);
}

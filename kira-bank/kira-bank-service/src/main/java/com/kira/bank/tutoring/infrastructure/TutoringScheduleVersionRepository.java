package com.kira.bank.tutoring.infrastructure;

import com.kira.bank.tutoring.domain.TutoringScheduleVersion;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.*;

public interface TutoringScheduleVersionRepository extends JpaRepository<TutoringScheduleVersion, Long> {
    @Query("select v from TutoringScheduleVersion v, TutoringScheduleSeries s where v.seriesId=s.id " +
        "and s.userId=:userId and s.deletedAt is null and v.deletedAt is null " +
        "and v.effectiveFrom<=:weekEnd and (v.effectiveTo is null or v.effectiveTo>=:weekStart)")
    List<TutoringScheduleVersion> findForWeek(@Param("userId") Long userId,
                                               @Param("weekStart") LocalDate weekStart,
                                               @Param("weekEnd") LocalDate weekEnd);

    @Query("select v from TutoringScheduleVersion v where v.seriesId=:seriesId and v.deletedAt is null " +
        "and v.effectiveFrom<=:date and (v.effectiveTo is null or v.effectiveTo>=:date)")
    Optional<TutoringScheduleVersion> findActive(@Param("seriesId") Long seriesId, @Param("date") LocalDate date);

    List<TutoringScheduleVersion> findBySeriesIdAndDeletedAtIsNullAndEffectiveFromGreaterThanEqual(
        Long seriesId, LocalDate effectiveFrom);

    @Query("select count(v)>0 from TutoringScheduleVersion v, TutoringScheduleSeries s where v.seriesId=s.id " +
        "and s.userId=:userId and s.deletedAt is null and v.studentId=:studentId and v.deletedAt is null " +
        "and (v.effectiveTo is null or v.effectiveTo>=:fromDate)")
    boolean hasCurrentOrFutureSchedule(@Param("userId") Long userId, @Param("studentId") Long studentId,
                                       @Param("fromDate") LocalDate fromDate);
}

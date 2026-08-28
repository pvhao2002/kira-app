package com.kira.bank.tutoring.infrastructure;

import com.kira.bank.tutoring.domain.TutoringScheduleSeries;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TutoringScheduleSeriesRepository extends JpaRepository<TutoringScheduleSeries, Long> {
    Optional<TutoringScheduleSeries> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);
}

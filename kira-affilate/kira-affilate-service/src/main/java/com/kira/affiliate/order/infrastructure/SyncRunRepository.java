package com.kira.affiliate.order.infrastructure;

import com.kira.affiliate.order.domain.SyncRun;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface SyncRunRepository extends JpaRepository<SyncRun, Long> {
    Page<SyncRun> findByUserIdOrderByStartedAtDescIdDesc(Long userId, Pageable pageable);

    Optional<SyncRun> findFirstByUserIdOrderByStartedAtDescIdDesc(Long userId);

    Optional<SyncRun> findFirstByUserIdAndStatusOrderByFinishedAtDesc(Long userId, String status);

    @Modifying
    @Query("update SyncRun r set r.status = 'FAILED', r.finishedAt = :now, r.errorCode = 'INTERRUPTED', "
        + "r.errorMessage = 'Máy chủ khởi động lại khi đang đồng bộ' where r.status = 'RUNNING'")
    int failInterrupted(@Param("now") Instant now);
}

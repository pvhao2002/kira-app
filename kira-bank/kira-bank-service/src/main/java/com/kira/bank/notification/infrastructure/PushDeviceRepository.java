package com.kira.bank.notification.infrastructure;

import com.kira.bank.notification.domain.PushDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface PushDeviceRepository extends JpaRepository<PushDevice, Long> {
    List<PushDevice> findByUserId(Long userId);

    Optional<PushDevice> findByToken(String token);

    @Modifying
    @Query("delete from PushDevice d where d.userId = :userId and d.token = :token")
    int deleteByUserIdAndToken(@Param("userId") Long userId, @Param("token") String token);

    @Modifying
    @Transactional
    @Query("delete from PushDevice d where d.token = :token")
    int deleteByToken(@Param("token") String token);
}

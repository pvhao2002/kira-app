package com.kira.bank.tutoring.infrastructure;

import com.kira.bank.tutoring.domain.TutoringStudent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface TutoringStudentRepository extends JpaRepository<TutoringStudent, Long> {
    List<TutoringStudent> findByUserIdAndDeletedAtIsNullOrderByNameAsc(Long userId);
    Optional<TutoringStudent> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);
}

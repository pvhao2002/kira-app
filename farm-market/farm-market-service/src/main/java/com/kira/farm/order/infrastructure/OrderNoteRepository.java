package com.kira.farm.order.infrastructure;

import com.kira.farm.order.domain.OrderNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderNoteRepository extends JpaRepository<OrderNote, Long> {
    List<OrderNote> findByOrderIdOrderByIdDesc(Long orderId);
}

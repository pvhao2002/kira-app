package com.kira.bank.attachment.infrastructure;

import com.kira.bank.attachment.domain.InvestmentAiJobEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvestmentAiJobEventRepository extends JpaRepository<InvestmentAiJobEvent, Long> {
    List<InvestmentAiJobEvent> findByAttachmentIdOrderByCreatedAtAscIdAsc(Long attachmentId);
}

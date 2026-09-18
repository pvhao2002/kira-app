package com.kira.bank.tutoring.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tutoring_schedule_series")
@Getter
@Setter
public class TutoringScheduleSeries extends AuditedEntity {
    @Column(nullable = false)
    private Long userId;
}

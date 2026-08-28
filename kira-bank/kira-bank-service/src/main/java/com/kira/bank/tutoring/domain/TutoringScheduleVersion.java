package com.kira.bank.tutoring.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.*;

@Entity @Table(name = "tutoring_schedule_versions") @Getter @Setter
public class TutoringScheduleVersion extends AuditedEntity {
    @Column(nullable = false) private Long seriesId;
    @Column(nullable = false) private Long studentId;
    @Column(nullable = false) private int dayOfWeek;
    @Column(nullable = false) private LocalTime startTime;
    @Column(nullable = false) private LocalTime endTime;
    @Column(nullable = false, length = 150) private String subject;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private TeachingMode teachingMode;
    @Column(length = 500) private String location;
    @Column(nullable = false, precision = 19, scale = 4) private BigDecimal fee;
    @Column(length = 2000) private String note;
    @Column(nullable = false) private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
}

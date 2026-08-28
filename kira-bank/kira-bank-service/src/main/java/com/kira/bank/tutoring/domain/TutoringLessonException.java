package com.kira.bank.tutoring.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.*;

@Entity @Table(name = "tutoring_lesson_exceptions") @Getter @Setter
public class TutoringLessonException extends AuditedEntity {
    @Column(nullable = false) private Long seriesId;
    @Column(nullable = false) private LocalDate occurrenceDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private LessonExceptionAction action;
    private LocalDate movedDate;
    private LocalTime movedStartTime;
    private LocalTime movedEndTime;
}

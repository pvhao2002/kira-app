package com.kira.bank.tutoring.application;

import com.kira.bank.tutoring.domain.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;

public final class TutoringDtos {
    private TutoringDtos() {}

    public record StudentRequest(@NotBlank @Size(max=150) String name, @Size(max=30) String phone,
                                 @NotBlank @Pattern(regexp="^#[0-9A-Fa-f]{6}$") String color,
                                 @Size(max=1000) String note, @Min(0) Long version) {}
    public record StudentResponse(Long id, String name, String phone, String color, String note, long version) {}

    public record SeriesRequest(@NotNull Long studentId, @Min(1) @Max(7) int dayOfWeek,
                                @NotNull LocalTime startTime, @NotNull LocalTime endTime,
                                @NotBlank @Size(max=150) String subject, @NotNull TeachingMode teachingMode,
                                @Size(max=500) String location, @NotNull @PositiveOrZero BigDecimal fee,
                                @Size(max=2000) String note, @NotNull LocalDate effectiveFrom,
                                @Min(0) Long version, boolean confirmConflict) {}
    public record SeriesResponse(Long id, long version) {}

    public record ExceptionRequest(@NotNull LessonExceptionAction action, LocalDate movedDate,
                                   LocalTime movedStartTime, LocalTime movedEndTime,
                                   @Min(0) Long version, boolean confirmConflict) {}
    public record RestoreExceptionRequest(@Min(0) long version, boolean confirmConflict) {}
    public record DeleteSeriesRequest(@NotNull LocalDate effectiveFrom, @Min(0) long version) {}
    public record DeleteStudentRequest(@Min(0) long version) {}

    public record LessonOccurrence(Long seriesId, long seriesVersion, Long studentId, String studentName,
                                   String studentPhone, String studentColor, LocalDate originalDate,
                                   LocalDate date, LocalTime startTime, LocalTime endTime, String subject,
                                   TeachingMode teachingMode, String location, BigDecimal fee, String note,
                                   LessonExceptionAction exceptionAction, Long exceptionVersion,
                                   boolean cancelled, boolean conflict) {}
    public record ConflictResponse(Long firstSeriesId, Long secondSeriesId, LocalDate date,
                                   LocalTime startTime, LocalTime endTime, String description) {}
    public record WeekResponse(LocalDate weekStart, LocalDate weekEnd, String timeZone, boolean readOnly,
                               int lessonCount, BigDecimal totalHours, BigDecimal totalFee,
                               List<ConflictResponse> conflicts, List<LessonOccurrence> lessons) {}
}

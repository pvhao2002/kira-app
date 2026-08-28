package com.kira.bank.tutoring.application;

import com.kira.bank.shared.web.ApiException;
import com.kira.bank.tutoring.domain.*;
import com.kira.bank.tutoring.infrastructure.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.bank.tutoring.application.TutoringDtos.*;

@Service @RequiredArgsConstructor
public class TutoringService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final LocalTime EARLIEST = LocalTime.of(6, 0);
    private static final LocalTime LATEST = LocalTime.of(23, 0);

    private final TutoringStudentRepository students;
    private final TutoringScheduleSeriesRepository seriesRepository;
    private final TutoringScheduleVersionRepository versions;
    private final TutoringLessonExceptionRepository exceptions;

    @Transactional(readOnly = true)
    public List<StudentResponse> students(Long userId) {
        return students.findByUserIdAndDeletedAtIsNullOrderByNameAsc(userId).stream().map(this::studentResponse).toList();
    }

    @Transactional
    public StudentResponse createStudent(Long userId, StudentRequest request) {
        TutoringStudent student = new TutoringStudent();
        student.setUserId(userId);
        apply(student, request);
        student.setCreatedBy(userId);
        student.setUpdatedBy(userId);
        return studentResponse(students.save(student));
    }

    @Transactional
    public StudentResponse updateStudent(Long userId, Long id, StudentRequest request) {
        TutoringStudent student = student(userId, id);
        requireVersion(student.getVersion(), request.version(), "TUTORING_STUDENT_VERSION_CONFLICT");
        apply(student, request);
        student.setUpdatedBy(userId);
        return studentResponse(students.save(student));
    }

    @Transactional
    public void deleteStudent(Long userId, Long id, DeleteStudentRequest request) {
        TutoringStudent student = student(userId, id);
        requireVersion(student.getVersion(), request.version(), "TUTORING_STUDENT_VERSION_CONFLICT");
        if (versions.hasCurrentOrFutureSchedule(userId, id, currentWeek())) {
            throw conflict("TUTORING_STUDENT_IN_USE", "Học viên vẫn còn lịch dạy hiện tại hoặc tương lai");
        }
        student.setDeletedAt(Instant.now());
        student.setUpdatedBy(userId);
    }

    @Transactional(readOnly = true)
    public WeekResponse week(Long userId, LocalDate weekStart) {
        requireMonday(weekStart);
        return resolve(userId, weekStart);
    }

    @Transactional
    public SeriesResponse createSeries(Long userId, SeriesRequest request) {
        validate(request);
        requireEditableWeek(request.effectiveFrom());
        student(userId, request.studentId());
        TutoringScheduleSeries series = new TutoringScheduleSeries();
        series.setUserId(userId);
        series.setCreatedBy(userId);
        series.setUpdatedBy(userId);
        seriesRepository.save(series);
        TutoringScheduleVersion version = version(series.getId(), userId, request);
        versions.save(version);
        requireConflictConfirmation(userId, request.effectiveFrom(), request.confirmConflict());
        return new SeriesResponse(series.getId(), series.getVersion());
    }

    @Transactional
    public SeriesResponse updateSeries(Long userId, Long id, SeriesRequest request) {
        validate(request);
        requireEditableWeek(request.effectiveFrom());
        student(userId, request.studentId());
        TutoringScheduleSeries series = series(userId, id);
        requireVersion(series.getVersion(), request.version(), "TUTORING_SERIES_VERSION_CONFLICT");
        replaceFrom(series, request.effectiveFrom(), userId);
        versions.save(version(id, userId, request));
        series.setUpdatedBy(userId);
        seriesRepository.saveAndFlush(series);
        requireConflictConfirmation(userId, request.effectiveFrom(), request.confirmConflict());
        return new SeriesResponse(id, series.getVersion());
    }

    @Transactional
    public void deleteSeries(Long userId, Long id, DeleteSeriesRequest request) {
        requireEditableWeek(request.effectiveFrom());
        TutoringScheduleSeries series = series(userId, id);
        requireVersion(series.getVersion(), request.version(), "TUTORING_SERIES_VERSION_CONFLICT");
        replaceFrom(series, request.effectiveFrom(), userId);
        series.setUpdatedBy(userId);
        seriesRepository.save(series);
    }

    @Transactional
    public void saveException(Long userId, Long seriesId, LocalDate occurrenceDate, ExceptionRequest request) {
        TutoringScheduleSeries series = series(userId, seriesId);
        requireEditableOccurrence(occurrenceDate);
        TutoringScheduleVersion source = versions.findActive(seriesId, occurrenceDate)
            .filter(value -> value.getDayOfWeek() == occurrenceDate.getDayOfWeek().getValue())
            .orElseThrow(() -> notFound("TUTORING_OCCURRENCE_NOT_FOUND", "Không tìm thấy buổi học gốc"));
        validateException(occurrenceDate, request);
        TutoringLessonException exception = exceptions.findBySeriesIdAndOccurrenceDate(seriesId, occurrenceDate)
            .orElseGet(TutoringLessonException::new);
        if (exception.getId() != null && exception.getDeletedAt() == null) {
            requireVersion(exception.getVersion(), request.version(), "TUTORING_EXCEPTION_VERSION_CONFLICT");
        }
        exception.setSeriesId(series.getId());
        exception.setOccurrenceDate(occurrenceDate);
        exception.setAction(request.action());
        exception.setMovedDate(request.action() == LessonExceptionAction.MOVE ? request.movedDate() : null);
        exception.setMovedStartTime(request.action() == LessonExceptionAction.MOVE ? request.movedStartTime() : null);
        exception.setMovedEndTime(request.action() == LessonExceptionAction.MOVE ? request.movedEndTime() : null);
        exception.setDeletedAt(null);
        if (exception.getId() == null) exception.setCreatedBy(userId);
        exception.setUpdatedBy(userId);
        exceptions.save(exception);
        requireConflictConfirmation(userId, monday(occurrenceDate), request.confirmConflict());
    }

    @Transactional
    public void restoreException(Long userId, Long seriesId, LocalDate occurrenceDate,
                                 RestoreExceptionRequest request) {
        series(userId, seriesId);
        requireEditableOccurrence(occurrenceDate);
        TutoringLessonException exception = exceptions.findBySeriesIdAndOccurrenceDate(seriesId, occurrenceDate)
            .filter(value -> value.getDeletedAt() == null)
            .orElseThrow(() -> notFound("TUTORING_EXCEPTION_NOT_FOUND", "Không tìm thấy ngoại lệ"));
        requireVersion(exception.getVersion(), request.version(), "TUTORING_EXCEPTION_VERSION_CONFLICT");
        exception.setDeletedAt(Instant.now());
        exception.setUpdatedBy(userId);
        exceptions.save(exception);
        requireConflictConfirmation(userId, monday(occurrenceDate), request.confirmConflict());
    }

    private WeekResponse resolve(Long userId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        List<TutoringScheduleVersion> active = versions.findForWeek(userId, weekStart, weekEnd);
        Set<Long> seriesIds = active.stream().map(TutoringScheduleVersion::getSeriesId).collect(Collectors.toSet());
        Map<String, TutoringLessonException> exceptionMap = seriesIds.isEmpty() ? Map.of() :
            exceptions.findBySeriesIdInAndOccurrenceDateBetweenAndDeletedAtIsNull(seriesIds, weekStart, weekEnd)
                .stream().collect(Collectors.toMap(value -> key(value.getSeriesId(), value.getOccurrenceDate()), Function.identity()));
        Map<Long, TutoringStudent> studentMap = students.findAllById(active.stream()
            .map(TutoringScheduleVersion::getStudentId).collect(Collectors.toSet())).stream()
            .collect(Collectors.toMap(TutoringStudent::getId, Function.identity()));
        Map<Long, Long> seriesVersions = seriesRepository.findAllById(seriesIds).stream()
            .collect(Collectors.toMap(TutoringScheduleSeries::getId, TutoringScheduleSeries::getVersion));

        List<MutableOccurrence> resolved = new ArrayList<>();
        for (TutoringScheduleVersion version : active) {
            LocalDate originalDate = weekStart.plusDays(version.getDayOfWeek() - 1L);
            if (originalDate.isBefore(version.getEffectiveFrom()) ||
                (version.getEffectiveTo() != null && originalDate.isAfter(version.getEffectiveTo()))) continue;
            TutoringStudent student = studentMap.get(version.getStudentId());
            if (student == null) continue;
            TutoringLessonException exception = exceptionMap.get(key(version.getSeriesId(), originalDate));
            boolean cancelled = exception != null && exception.getAction() == LessonExceptionAction.CANCEL;
            LocalDate date = exception != null && exception.getAction() == LessonExceptionAction.MOVE ? exception.getMovedDate() : originalDate;
            LocalTime start = exception != null && exception.getAction() == LessonExceptionAction.MOVE ? exception.getMovedStartTime() : version.getStartTime();
            LocalTime end = exception != null && exception.getAction() == LessonExceptionAction.MOVE ? exception.getMovedEndTime() : version.getEndTime();
            resolved.add(new MutableOccurrence(version, seriesVersions.getOrDefault(version.getSeriesId(), 0L),
                student, originalDate, date, start, end, exception, cancelled));
        }
        resolved.sort(Comparator.comparing((MutableOccurrence value) -> value.date).thenComparing(value -> value.start));
        List<ConflictResponse> conflicts = conflicts(resolved);
        Set<Long> conflictSeries = conflicts.stream().flatMap(value -> List.of(value.firstSeriesId(), value.secondSeriesId()).stream()).collect(Collectors.toSet());
        List<LessonOccurrence> lessons = resolved.stream().map(value -> value.response(conflictSeries.contains(value.version.getSeriesId()))).toList();
        List<MutableOccurrence> included = resolved.stream().filter(value -> !value.cancelled).toList();
        long minutes = included.stream().mapToLong(value -> Duration.between(value.start, value.end).toMinutes()).sum();
        BigDecimal totalHours = BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        BigDecimal totalFee = included.stream().map(value -> value.version.getFee()).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new WeekResponse(weekStart, weekEnd, ZONE.getId(), weekStart.isBefore(currentWeek()),
            included.size(), totalHours, totalFee, conflicts, lessons);
    }

    private List<ConflictResponse> conflicts(List<MutableOccurrence> lessons) {
        List<ConflictResponse> result = new ArrayList<>();
        for (int first = 0; first < lessons.size(); first++) {
            MutableOccurrence a = lessons.get(first);
            if (a.cancelled) continue;
            for (int second = first + 1; second < lessons.size(); second++) {
                MutableOccurrence b = lessons.get(second);
                if (b.cancelled || !a.date.equals(b.date)) continue;
                if (a.start.isBefore(b.end) && b.start.isBefore(a.end)) {
                    LocalTime start = a.start.isAfter(b.start) ? a.start : b.start;
                    LocalTime end = a.end.isBefore(b.end) ? a.end : b.end;
                    result.add(new ConflictResponse(a.version.getSeriesId(), b.version.getSeriesId(), a.date, start, end,
                        a.student.getName() + " · " + a.version.getSubject() + " ↔ " + b.student.getName() + " · " + b.version.getSubject()));
                }
            }
        }
        return result;
    }

    private void requireConflictConfirmation(Long userId, LocalDate weekStart, boolean confirmed) {
        List<ConflictResponse> conflicts = resolve(userId, weekStart).conflicts();
        if (conflicts.isEmpty() || confirmed) return;
        Map<String, String> details = new LinkedHashMap<>();
        for (int i = 0; i < conflicts.size(); i++) {
            ConflictResponse value = conflicts.get(i);
            details.put("conflict." + i, value.date() + "|" + value.startTime() + "|" + value.endTime() + "|" + value.description());
        }
        throw new ApiException(HttpStatus.CONFLICT, "TUTOR_SCHEDULE_CONFLICT",
            "Lịch mới bị trùng giờ. Bạn vẫn có thể xác nhận để lưu.", details);
    }

    private void replaceFrom(TutoringScheduleSeries series, LocalDate effectiveFrom, Long userId) {
        TutoringScheduleVersion current = versions.findActive(series.getId(), effectiveFrom)
            .orElseThrow(() -> notFound("TUTORING_SERIES_NOT_ACTIVE", "Lịch không còn hiệu lực ở tuần đã chọn"));
        Instant now = Instant.now();
        versions.findBySeriesIdAndDeletedAtIsNullAndEffectiveFromGreaterThanEqual(series.getId(), effectiveFrom)
            .forEach(value -> { value.setDeletedAt(now); value.setUpdatedBy(userId); });
        if (current.getEffectiveFrom().isBefore(effectiveFrom)) {
            current.setEffectiveTo(effectiveFrom.minusDays(1));
            current.setUpdatedBy(userId);
        } else {
            current.setDeletedAt(now);
            current.setUpdatedBy(userId);
        }
        exceptions.findBySeriesIdAndOccurrenceDateGreaterThanEqualAndDeletedAtIsNull(series.getId(), effectiveFrom)
            .forEach(value -> { value.setDeletedAt(now); value.setUpdatedBy(userId); });
    }

    private TutoringScheduleVersion version(Long seriesId, Long userId, SeriesRequest request) {
        TutoringScheduleVersion version = new TutoringScheduleVersion();
        version.setSeriesId(seriesId);
        version.setStudentId(request.studentId());
        version.setDayOfWeek(request.dayOfWeek());
        version.setStartTime(request.startTime());
        version.setEndTime(request.endTime());
        version.setSubject(request.subject().trim());
        version.setTeachingMode(request.teachingMode());
        version.setLocation(blank(request.location()));
        version.setFee(request.fee());
        version.setNote(blank(request.note()));
        version.setEffectiveFrom(request.effectiveFrom());
        version.setCreatedBy(userId);
        version.setUpdatedBy(userId);
        return version;
    }

    private void validate(SeriesRequest request) {
        requireMonday(request.effectiveFrom());
        validateTime(request.startTime(), request.endTime());
    }

    private void validateException(LocalDate occurrenceDate, ExceptionRequest request) {
        if (request.action() == LessonExceptionAction.CANCEL) return;
        if (request.movedDate() == null || request.movedStartTime() == null || request.movedEndTime() == null)
            throw bad("TUTORING_MOVE_REQUIRED", "Buổi dời lịch cần ngày và giờ mới");
        if (!monday(occurrenceDate).equals(monday(request.movedDate())))
            throw bad("TUTORING_MOVE_OUTSIDE_WEEK", "Ngoại lệ một lần phải nằm trong cùng tuần");
        validateTime(request.movedStartTime(), request.movedEndTime());
    }

    private void validateTime(LocalTime start, LocalTime end) {
        if (start.isBefore(EARLIEST) || end.isAfter(LATEST) || !end.isAfter(start))
            throw bad("TUTORING_INVALID_TIME", "Giờ dạy phải nằm trong 06:00–23:00 và giờ kết thúc phải sau giờ bắt đầu");
        if (start.getMinute() % 5 != 0 || end.getMinute() % 5 != 0 || start.getSecond() != 0 || end.getSecond() != 0)
            throw bad("TUTORING_INVALID_TIME_STEP", "Thời gian phải theo bước 5 phút");
    }

    private void requireMonday(LocalDate date) {
        if (date == null || date.getDayOfWeek() != DayOfWeek.MONDAY)
            throw bad("TUTORING_WEEK_START_INVALID", "Tuần phải bắt đầu vào Thứ Hai");
    }
    private void requireEditableWeek(LocalDate date) { requireMonday(date); if (date.isBefore(currentWeek())) throw conflict("TUTORING_PAST_READ_ONLY", "Tuần trước chỉ được xem"); }
    private void requireEditableOccurrence(LocalDate date) { if (monday(date).isBefore(currentWeek())) throw conflict("TUTORING_PAST_READ_ONLY", "Tuần trước chỉ được xem"); }
    private LocalDate currentWeek() { return monday(LocalDate.now(ZONE)); }
    private LocalDate monday(LocalDate date) { return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); }
    private String key(Long seriesId, LocalDate date) { return seriesId + ":" + date; }

    private void apply(TutoringStudent student, StudentRequest request) {
        student.setName(request.name().trim());
        student.setPhone(blank(request.phone()));
        student.setColor(request.color().toUpperCase(Locale.ROOT));
        student.setNote(blank(request.note()));
    }
    private StudentResponse studentResponse(TutoringStudent value) { return new StudentResponse(value.getId(), value.getName(), value.getPhone(), value.getColor(), value.getNote(), value.getVersion()); }
    private TutoringStudent student(Long userId, Long id) { return students.findByIdAndUserIdAndDeletedAtIsNull(id, userId).orElseThrow(() -> notFound("TUTORING_STUDENT_NOT_FOUND", "Không tìm thấy học viên")); }
    private TutoringScheduleSeries series(Long userId, Long id) { return seriesRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId).orElseThrow(() -> notFound("TUTORING_SERIES_NOT_FOUND", "Không tìm thấy lịch dạy")); }
    private void requireVersion(long actual, Long requested, String code) { if (requested == null || actual != requested) throw conflict(code, "Dữ liệu đã thay đổi, hãy tải lại"); }
    private String blank(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
    private ApiException conflict(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }
    private ApiException notFound(String code, String message) { return new ApiException(HttpStatus.NOT_FOUND, code, message); }

    private static final class MutableOccurrence {
        private final TutoringScheduleVersion version; private final long seriesVersion; private final TutoringStudent student;
        private final LocalDate originalDate; private final LocalDate date; private final LocalTime start; private final LocalTime end;
        private final TutoringLessonException exception; private final boolean cancelled;
        private MutableOccurrence(TutoringScheduleVersion version, long seriesVersion, TutoringStudent student, LocalDate originalDate,
                                  LocalDate date, LocalTime start, LocalTime end, TutoringLessonException exception,
                                  boolean cancelled) {
            this.version=version; this.seriesVersion=seriesVersion; this.student=student; this.originalDate=originalDate; this.date=date;
            this.start=start; this.end=end; this.exception=exception; this.cancelled=cancelled;
        }
        private LessonOccurrence response(boolean conflict) {
            return new LessonOccurrence(version.getSeriesId(), seriesVersion, student.getId(), student.getName(), student.getPhone(),
                student.getColor(), originalDate, date, start, end, version.getSubject(), version.getTeachingMode(),
                version.getLocation(), version.getFee(), version.getNote(), exception == null ? null : exception.getAction(),
                exception == null ? null : exception.getVersion(), cancelled, conflict && !cancelled);
        }
    }
}

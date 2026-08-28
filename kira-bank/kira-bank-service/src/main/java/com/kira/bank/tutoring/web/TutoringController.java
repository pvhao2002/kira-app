package com.kira.bank.tutoring.web;

import com.kira.bank.tutoring.application.TutoringService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import static com.kira.bank.tutoring.application.TutoringDtos.*;

@RestController @RequestMapping("/api/v1/tutoring") @RequiredArgsConstructor
public class TutoringController {
    private final TutoringService service;

    @GetMapping("/week") WeekResponse week(@AuthenticationPrincipal Long user,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate weekStart) { return service.week(user, weekStart); }

    @GetMapping("/students") List<StudentResponse> students(@AuthenticationPrincipal Long user) { return service.students(user); }
    @PostMapping("/students") @ResponseStatus(HttpStatus.CREATED) StudentResponse createStudent(
        @AuthenticationPrincipal Long user, @Valid @RequestBody StudentRequest request) { return service.createStudent(user, request); }
    @PutMapping("/students/{id}") StudentResponse updateStudent(@AuthenticationPrincipal Long user, @PathVariable Long id,
        @Valid @RequestBody StudentRequest request) { return service.updateStudent(user, id, request); }
    @DeleteMapping("/students/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void deleteStudent(
        @AuthenticationPrincipal Long user, @PathVariable Long id, @Valid @RequestBody DeleteStudentRequest request) {
        service.deleteStudent(user, id, request);
    }

    @PostMapping("/series") @ResponseStatus(HttpStatus.CREATED) SeriesResponse createSeries(
        @AuthenticationPrincipal Long user, @Valid @RequestBody SeriesRequest request) { return service.createSeries(user, request); }
    @PutMapping("/series/{id}") SeriesResponse updateSeries(@AuthenticationPrincipal Long user, @PathVariable Long id,
        @Valid @RequestBody SeriesRequest request) { return service.updateSeries(user, id, request); }
    @DeleteMapping("/series/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void deleteSeries(
        @AuthenticationPrincipal Long user, @PathVariable Long id, @Valid @RequestBody DeleteSeriesRequest request) {
        service.deleteSeries(user, id, request);
    }

    @PutMapping("/series/{seriesId}/occurrences/{occurrenceDate}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void saveException(@AuthenticationPrincipal Long user, @PathVariable Long seriesId,
        @PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate occurrenceDate,
        @Valid @RequestBody ExceptionRequest request) { service.saveException(user, seriesId, occurrenceDate, request); }
    @DeleteMapping("/series/{seriesId}/occurrences/{occurrenceDate}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void restoreException(@AuthenticationPrincipal Long user, @PathVariable Long seriesId,
        @PathVariable @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate occurrenceDate,
        @Valid @RequestBody RestoreExceptionRequest request) { service.restoreException(user, seriesId, occurrenceDate, request); }
}

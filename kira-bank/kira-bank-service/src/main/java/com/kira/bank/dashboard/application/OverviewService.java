package com.kira.bank.dashboard.application;

import com.kira.bank.dashboard.infrastructure.OverviewRepository;
import com.kira.bank.tutoring.application.TutoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;
import java.util.stream.Stream;

import static com.kira.bank.dashboard.application.OverviewDtos.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OverviewService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final OverviewRepository repository;
    private final CreditCardDashboardService creditCards;
    private final TutoringService tutoring;

    public Credit credit(Long userId) {
        LocalDate today = LocalDate.now(ZONE);
        String outstanding = "s.status not in ('PAID','CANCELLED','NEEDS_INPUT') and s.remaining_amount > 0 and ";
        var dashboard = creditCards.dashboard(userId);
        var summary = new CreditSummary(dashboard.totalCreditLimit(), dashboard.currentBalance(), dashboard.availableCredit(),
            dashboard.utilizationRate(), dashboard.currency(), dashboard.banks().size(),
            dashboard.banks().stream().mapToInt(CreditCardDashboardDtos.BankDebtResponse::cardCount).sum());
        return new Credit(Instant.now(), summary,
            repository.dues(userId, outstanding + "s.due_date < ?", today),
            repository.dues(userId, outstanding + "s.due_date = ?", today),
            repository.dues(userId, outstanding + "s.due_date > ? and s.due_date < ?", today, today.plusDays(7)),
            repository.dues(userId, "s.status = 'NEEDS_INPUT'"));
    }

    public Tutoring tutoring(Long userId) {
        ZonedDateTime now = ZonedDateTime.now(ZONE);
        LocalDate today = now.toLocalDate(), monday = today.minusDays(today.getDayOfWeek().getValue() - 1L);
        var week = tutoring.week(userId, monday);
        var next = tutoring.week(userId, monday.plusWeeks(1));
        var upcoming = Stream.concat(week.lessons().stream(), next.lessons().stream())
            .filter(lesson -> !lesson.cancelled() && !lesson.date().isBefore(today) && lesson.date().isBefore(today.plusDays(7))
                && lesson.date().atTime(lesson.endTime()).isAfter(now.toLocalDateTime()))
            .sorted(Comparator.comparing(com.kira.bank.tutoring.application.TutoringDtos.LessonOccurrence::date)
                .thenComparing(com.kira.bank.tutoring.application.TutoringDtos.LessonOccurrence::startTime))
            .map(lesson -> new Lesson(lesson.seriesId(), lesson.date(), lesson.startTime(), lesson.endTime(),
                lesson.studentName(), lesson.subject(), lesson.fee())).toList();
        var conflicts = Stream.concat(week.conflicts().stream(), next.conflicts().stream())
            .filter(conflict -> !conflict.date().isBefore(today) && conflict.date().isBefore(today.plusDays(7))
                && conflict.date().atTime(conflict.endTime()).isAfter(now.toLocalDateTime()))
            .sorted(Comparator.comparing(com.kira.bank.tutoring.application.TutoringDtos.ConflictResponse::date)
                .thenComparing(com.kira.bank.tutoring.application.TutoringDtos.ConflictResponse::startTime))
            .map(conflict -> new Conflict(conflict.date(), conflict.startTime(), conflict.description())).toList();
        return new Tutoring(Instant.now(), monday, monday.plusDays(6), week.lessonCount(), week.totalHours(), week.totalFee(),
            new Group<>(upcoming.size(), upcoming.stream().limit(5).toList()),
            new Group<>(conflicts.size(), conflicts.stream().limit(5).toList()));
    }

    public Investments investments(Long userId, int days) { return repository.investments(userId, days); }
}

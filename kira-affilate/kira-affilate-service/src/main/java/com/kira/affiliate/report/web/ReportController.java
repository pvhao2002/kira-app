package com.kira.affiliate.report.web;

import com.kira.affiliate.report.application.ReportService;
import com.kira.affiliate.report.application.ReportService.Point;
import com.kira.affiliate.report.application.ReportService.Summary;
import com.kira.affiliate.report.application.ReportService.TopRow;
import com.kira.affiliate.shared.web.DateRange;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {
    private final ReportService reports;

    @GetMapping("/summary")
    public Summary summary(@AuthenticationPrincipal Long userId,
                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reports.summary(userId, DateRange.of(from, to));
    }

    @GetMapping("/timeseries")
    public List<Point> timeseries(@AuthenticationPrincipal Long userId,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                  @RequestParam(defaultValue = "day") String granularity) {
        return reports.timeseries(userId, DateRange.of(from, to), granularity);
    }

    @GetMapping("/top")
    public List<TopRow> top(@AuthenticationPrincipal Long userId,
                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                            @RequestParam(defaultValue = "product") String by,
                            @RequestParam(defaultValue = "10") int limit) {
        return reports.top(userId, DateRange.of(from, to), by, limit);
    }
}

package com.kira.bank.investment.web;

import com.kira.bank.investment.application.AdminInvestmentSummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** Under /api/v1/admin/**, which SecurityConfig already restricts to ROLE_ADMIN. */
@RestController
@RequestMapping("/api/v1/admin/investment/reports")
@RequiredArgsConstructor
public class AdminInvestmentSummaryController {
    private final AdminInvestmentSummaryService summary;

    @GetMapping("/summary")
    Object summary(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return summary.summary(fromDate, toDate);
    }
}

package com.kira.bank.investment.web;

import com.kira.bank.investment.application.InvestmentReconciliationReportDtos.UpdateReportStatusRequest;
import com.kira.bank.investment.application.InvestmentReconciliationReportService;
import com.kira.bank.investment.domain.InvestmentReconciliationReportStatus;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/investment/reconciliation-reports")
@RequiredArgsConstructor
public class AdminInvestmentReconciliationReportController {
    private final InvestmentReconciliationReportService reports;

    @GetMapping
    Object list(@RequestParam(required = false) InvestmentReconciliationReportStatus status,
                @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return reports.all(pageable, status);
    }

    @PatchMapping("/{id}/status")
    Object updateStatus(@AuthenticationPrincipal Long admin, @PathVariable Long id,
                        @Valid @RequestBody UpdateReportStatusRequest request) {
        return reports.updateStatus(admin, id, request);
    }
}

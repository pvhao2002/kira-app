package com.kira.bank.dashboard.web;

import com.kira.bank.dashboard.application.OverviewDtos.Credit;
import com.kira.bank.dashboard.application.OverviewDtos.Investments;
import com.kira.bank.dashboard.application.OverviewDtos.Tutoring;
import com.kira.bank.dashboard.application.OverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboards/overview")
@RequiredArgsConstructor
public class OverviewController {
    private final OverviewService overview;

    @GetMapping("/credit-cards")
    Credit credit(@AuthenticationPrincipal Long user) {
        return overview.credit(user);
    }

    @GetMapping("/investments")
    Investments investments(@AuthenticationPrincipal Long user, @RequestParam(defaultValue = "30") int days) {
        return overview.investments(user, days);
    }

    @GetMapping("/tutoring")
    Tutoring tutoring(@AuthenticationPrincipal Long user) {
        return overview.tutoring(user);
    }
}

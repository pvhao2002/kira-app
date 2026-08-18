package com.kira.bank.dashboard.web;

import com.kira.bank.dashboard.application.CreditCardDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.kira.bank.dashboard.application.CreditCardDashboardDtos.CreditCardDashboardResponse;

@RestController
@RequestMapping("/api/v1/dashboards")
@RequiredArgsConstructor
public class DashboardController {
    private final CreditCardDashboardService creditCardDashboard;

    @GetMapping("/credit-cards")
    CreditCardDashboardResponse creditCards(@AuthenticationPrincipal Long user) {
        return creditCardDashboard.dashboard(user);
    }
}

package com.db.kiragateway.rest;

import com.db.kiragateway.dashboard.DashboardService;
import com.db.kiragateway.dashboard.dto.DashboardResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardResponse get(@AuthenticationPrincipal Jwt jwt) {
        return dashboardService.build(
                currentUserId(jwt),
                jwt.getSubject(),
                jwt.getClaimAsString("role")
        );
    }

    private static int currentUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        var uid = jwt.getClaim("uid");
        if (uid instanceof Number n && n.intValue() > 0) {
            return n.intValue();
        }
        throw new IllegalArgumentException("Missing user id in token");
    }
}

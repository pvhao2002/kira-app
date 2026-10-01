package com.kira.farm.dashboard.web;

import com.kira.farm.dashboard.application.CustomerAdminService;
import com.kira.farm.dashboard.application.DashboardService;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import static com.kira.farm.dashboard.application.DashboardDtos.*;

@Tag(name = "Admin dashboard")
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService dashboard;
    private final CustomerAdminService customers;

    @GetMapping("/dashboard")
    public DashboardResponse dashboard(@RequestParam(required = false) Long branchId,
                                       @RequestParam(defaultValue = "30") int days) {
        return dashboard.dashboard(branchId, days);
    }

    @GetMapping("/customers")
    public PageResponse<CustomerResponse> customers(@RequestParam(required = false) String q,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size) {
        return customers.list(q, page, size);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/customers/{id}/lock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void lock(@PathVariable Long id) {
        customers.setLocked(id, true);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/customers/{id}/unlock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlock(@PathVariable Long id) {
        customers.setLocked(id, false);
    }
}

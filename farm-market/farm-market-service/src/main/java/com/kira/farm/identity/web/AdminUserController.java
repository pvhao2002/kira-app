package com.kira.farm.identity.web;

import com.kira.farm.identity.application.AdminUserService;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import static com.kira.farm.identity.application.AdminUserService.*;

@Tag(name = "Admin users")
@PreAuthorize("hasRole('ADMIN')")
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {
    private final AdminUserService service;

    @GetMapping
    public PageResponse<UserSummary> list(@RequestParam(required = false) Role role,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        return service.list(role, q, page, size);
    }

    @PostMapping("/{id}/otp/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetOtp(@PathVariable Long id) {
        service.resetOtp(id, CurrentUser.id());
    }

    @PutMapping("/{id}/branches")
    public UserSummary assignBranches(@PathVariable Long id, @Valid @RequestBody BranchAssignmentRequest request) {
        return service.assignBranches(id, request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserSummary create(@Valid @RequestBody CreateUserRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}/role")
    public UserSummary changeRole(@PathVariable Long id, @Valid @RequestBody ChangeRoleRequest request) {
        return service.changeRole(id, CurrentUser.id(), request);
    }
}

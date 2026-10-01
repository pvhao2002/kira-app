package com.kira.farm.branch.web;

import com.kira.farm.branch.application.BranchService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.kira.farm.branch.application.BranchDtos.*;

@Tag(name = "Branches")
@RestController
@RequiredArgsConstructor
public class BranchController {
    private final BranchService service;

    @GetMapping("/api/v1/branches")
    public List<BranchResponse> list() {
        return service.listPublic();
    }

    /** Branches the caller may work in (assigned ones for staff/manager, all for admin). */
    @GetMapping("/api/v1/admin/branches")
    public List<BranchResponse> mine() {
        return service.listAccessible();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/api/v1/admin/branches/{id}/theme")
    public BranchResponse theme(@PathVariable Long id, @Valid @RequestBody ThemeRequest request) {
        return service.updateTheme(id, request);
    }
}

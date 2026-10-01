package com.kira.farm.branch.application;

import com.kira.farm.branch.domain.Branch;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

import static com.kira.farm.branch.application.BranchDtos.*;

@Service
@RequiredArgsConstructor
public class BranchService {
    private final BranchRepository branches;
    private final BranchAccess access;

    @Transactional(readOnly = true)
    public List<BranchResponse> listPublic() {
        return branches.findAllByOrderByIdAsc().stream().map(BranchResponse::of).toList();
    }

    @Transactional(readOnly = true)
    public List<BranchResponse> listAccessible() {
        return branches.findByIdInOrderByIdAsc(access.accessibleBranchIds()).stream().map(BranchResponse::of).toList();
    }

    @Transactional(readOnly = true)
    public Branch require(Long id) {
        return branches.findById(id).orElseThrow(() -> ApiException.notFound("BRANCH_NOT_FOUND",
            "Không tìm thấy chi nhánh"));
    }

    /** Caller must already be restricted to ADMIN at the controller. */
    @Transactional
    public BranchResponse updateTheme(Long id, ThemeRequest request) {
        Branch b = require(id);
        b.setThemePrimary(request.primary().toLowerCase(Locale.ROOT));
        b.setThemeAccent(request.accent().toLowerCase(Locale.ROOT));
        return BranchResponse.of(branches.save(b));
    }
}

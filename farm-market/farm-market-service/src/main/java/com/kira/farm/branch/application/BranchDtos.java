package com.kira.farm.branch.application;

import com.kira.farm.branch.domain.Branch;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public final class BranchDtos {
    private BranchDtos() {
    }

    public record BranchResponse(Long id, String code, String name, String shortName, String address, String hours,
                                 boolean open, String themePrimary, String themeAccent, String managerName,
                                 String phone) {
        public static BranchResponse of(Branch b) {
            return new BranchResponse(b.getId(), b.getCode(), b.getName(), b.getShortName(), b.getAddress(),
                b.getHours(), b.isOpenFlag(), b.getThemePrimary(), b.getThemeAccent(), b.getManagerName(),
                b.getPhone());
        }
    }

    public record ThemeRequest(
        @NotBlank @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Màu chính phải có dạng #rrggbb") String primary,
        @NotBlank @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Màu nhấn phải có dạng #rrggbb") String accent) {
    }
}

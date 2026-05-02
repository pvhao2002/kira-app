package com.db.kiragateway.useradmin.dto;

import com.db.kiragateway.useradmin.model.UserAdminRow;

import java.util.List;

public record UserAdminPage(
        List<UserAdminRow> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}

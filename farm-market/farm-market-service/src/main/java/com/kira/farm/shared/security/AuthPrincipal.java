package com.kira.farm.shared.security;

import com.kira.farm.identity.domain.Role;

import java.util.Set;

/** The authenticated caller. branchIds is the staff/manager assignment (empty for customers; admin sees all). */
public record AuthPrincipal(Long userId, Role role, Set<Long> branchIds) {
    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public boolean isBackoffice() {
        return role != Role.CUSTOMER;
    }
}

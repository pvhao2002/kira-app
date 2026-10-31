package com.kira.news.identity;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serializable;
import java.util.Collection;
import java.util.List;

/** The signed-in principal kept in the HTTP session. */
public record CurrentUser(String username, String displayName, Role role, String passwordHash)
        implements UserDetails, Serializable {

    public CurrentUser(NewsUser user) {
        this(user.getUsername(), user.getDisplayName(), user.getRole(), user.getPasswordHash());
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }

    // Never keep the hash in the session or logs.
    @Override
    public String toString() {
        return "CurrentUser[" + username + ", " + role + "]";
    }
}

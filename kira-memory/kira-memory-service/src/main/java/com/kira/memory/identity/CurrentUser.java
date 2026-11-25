package com.kira.memory.identity;

/** The signed-in account, taken from the session cookie. */
public record CurrentUser(long id, String username, String role, String displayName) {
    public boolean admin() {
        return "ADMIN".equals(role);
    }
}

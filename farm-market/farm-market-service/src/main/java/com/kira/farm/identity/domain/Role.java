package com.kira.farm.identity.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

/** Serialised lowercase to match the UI ('customer' | 'staff' | 'manager' | 'admin'). */
public enum Role {
    CUSTOMER, STAFF, MANAGER, ADMIN;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static Role fromJson(String value) {
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    public boolean isBackoffice() {
        return this != CUSTOMER;
    }

    public String authority() {
        return "ROLE_" + name();
    }
}

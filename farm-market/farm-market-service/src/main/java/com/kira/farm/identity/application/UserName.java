package com.kira.farm.identity.application;

/** Id + display name projection (JPQL constructor expression), so name lookups never load whole users. */
public record UserName(Long id, String fullName) {
}

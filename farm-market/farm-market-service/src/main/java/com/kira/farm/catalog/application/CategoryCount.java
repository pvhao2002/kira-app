package com.kira.farm.catalog.application;

/** Active-product count per category (JPQL constructor expression). */
public record CategoryCount(Long categoryId, long count) {
}

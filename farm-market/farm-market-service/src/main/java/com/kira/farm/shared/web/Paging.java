package com.kira.farm.shared.web;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

public final class Paging {
    public static final int MAX_SIZE = 100;

    private Paging() {
    }

    public static PageRequest of(int page, int size, Sort sort) {
        if (page < 0 || size < 1 || size > MAX_SIZE)
            throw ApiException.badRequest("INVALID_PAGINATION", "Phân trang không hợp lệ");
        return PageRequest.of(page, size, sort);
    }

    public static PageRequest of(int page, int size) {
        return of(page, size, Sort.unsorted());
    }
}

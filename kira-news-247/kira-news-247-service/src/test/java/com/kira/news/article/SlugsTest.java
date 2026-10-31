package com.kira.news.article;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SlugsTest {
    @Test
    void stripsVietnameseDiacritics() {
        assertThat(Slugs.of("Đường sắt cao tốc Bắc – Nam: 70 tỷ USD?")).isEqualTo("duong-sat-cao-toc-bac-nam-70-ty-usd");
        assertThat(Slugs.of("  ---  ")).isEmpty();
    }

    @Test
    void capsLength() {
        assertThat(Slugs.of("a".repeat(500))).hasSize(150);
    }
}

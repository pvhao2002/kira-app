package com.kira.farm.catalog;

import com.kira.farm.catalog.application.Slugs;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SlugsTest {
    @Test
    void vietnameseDiacriticsAndPunctuation() {
        assertEquals("trung-ga-ta-10-qua", Slugs.slugify("Trứng gà ta – 10 quả"));
        assertEquals("duong-do", Slugs.slugify("Đường Đỏ"));
        assertEquals("a-b", Slugs.slugify("  --A &&& B--  "));
    }

    @Test
    void emptyFallsBackToDefault() {
        assertEquals("san-pham", Slugs.slugify("!!!"));
        assertEquals("san-pham", Slugs.slugify(""));
    }
}

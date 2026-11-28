package com.matchmind.shared;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BandsTest {
    @Test
    void sqlIsOneCaseOverTheBands() {
        assertThat(Bands.sql("x", Bands.PRICE)).isEqualTo("CASE WHEN (x) <= 1.65 THEN '1.65 or lower' WHEN (x) <= 1.80 THEN"
            + " '1.66-1.80' WHEN (x) <= 1.90 THEN '1.81-1.90' WHEN (x) <= 2.05 THEN '1.91-2.05' ELSE 'above 2.05' END");
    }

    @Test
    void everyListEndsWithOneCatchAll() {
        for (List<Bands.Band> bands : List.of(Bands.PRICE, Bands.EDGE, Bands.PROBABILITY)) {
            assertThat(bands.getLast().test()).isNull();
            assertThat(bands.subList(0, bands.size() - 1)).allSatisfy(b -> assertThat(b.test()).isNotBlank());
            // Labels are SQL string literals: a quote would end them.
            assertThat(bands).allSatisfy(b -> assertThat(b.label()).doesNotContain("'"));
        }
    }
}

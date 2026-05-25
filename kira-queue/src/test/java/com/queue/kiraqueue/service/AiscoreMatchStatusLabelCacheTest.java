package com.queue.kiraqueue.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.lang.reflect.Field;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(MockitoExtension.class)
class AiscoreMatchStatusLabelCacheTest {

    @Mock
    private NamedParameterJdbcTemplate jdbcTemplate;

    private AiscoreMatchStatusLabelCache cache;

    @BeforeEach
    void setUp() throws Exception {
        cache = new AiscoreMatchStatusLabelCache(jdbcTemplate);
        setLabels(cache, Map.of(
                2, "1H",
                12, "Canceled",
                1, "-"
        ));
    }

    @Test
    void resolveStatus_mapsKnownStatusIdToLabel() {
        assertEquals("1H", cache.resolveStatus(2, "2"));
    }

    @Test
    void resolveStatus_mapsCancelledStatusId() {
        assertEquals("Canceled", cache.resolveStatus(12, null));
    }

    @Test
    void resolveStatus_nullStatusIdUsesApiFallback() {
        assertEquals("FT", cache.resolveStatus(null, "FT"));
    }

    @Test
    void resolveStatus_unknownStatusIdUsesApiFallback() {
        assertEquals("x", cache.resolveStatus(999, "x"));
    }

    @Test
    void resolveStatus_knownStatusIdWithDashLabel() {
        assertEquals("-", cache.resolveStatus(1, null));
    }

    private static void setLabels(AiscoreMatchStatusLabelCache cache, Map<Integer, String> labels) throws Exception {
        Field field = AiscoreMatchStatusLabelCache.class.getDeclaredField("labelsByStatusId");
        field.setAccessible(true);
        field.set(cache, Map.copyOf(labels));
    }
}

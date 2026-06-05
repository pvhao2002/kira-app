package com.db.kiragateway.config.security;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CorsOriginPatternsTest {

    @Test
    void splitsCommaSeparatedOriginsFromSingleEnvValue() {
        var patterns = CorsOriginPatterns.buildAllowedOriginPatterns(
                List.of("https://kira.id.vn,https://www.kira.id.vn")
        );

        assertTrue(patterns.contains("https://kira.id.vn"));
        assertTrue(patterns.contains("https://www.kira.id.vn"));
    }
}

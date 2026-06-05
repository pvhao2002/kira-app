package com.db.kiragateway.config.security;

import java.util.ArrayList;
import java.util.List;

final class CorsOriginPatterns {

    private CorsOriginPatterns() {
    }

    static List<String> buildAllowedOriginPatterns(List<String> configuredOrigins) {
        var patterns = new ArrayList<String>();
        patterns.add("http://localhost:*");
        patterns.add("https://localhost:*");
        patterns.add("http://127.*.*.*:*");
        patterns.add("https://127.*.*.*:*");

        if (configuredOrigins == null) {
            return patterns;
        }

        for (var entry : configuredOrigins) {
            if (entry == null || entry.isBlank()) {
                continue;
            }
            // Env vars like "https://a.com,https://b.com" bind as a single list element.
            for (var part : entry.split(",")) {
                var origin = part.trim();
                if (!origin.isBlank() && !"*".equals(origin) && !patterns.contains(origin)) {
                    patterns.add(origin);
                }
            }
        }
        return patterns;
    }
}

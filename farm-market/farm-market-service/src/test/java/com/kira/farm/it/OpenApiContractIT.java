package com.kira.farm.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Guard rail: the published OpenAPI document (paths, operations, schemas) must equal the checked-in baseline, which was
 * generated from the pre-optimisation code. Regenerate only on a conscious contract change:
 * {@code -Dopenapi.regen=true} (failsafe: {@code -DargLine}-free, pass as env OPENAPI_REGEN=true).
 */
class OpenApiContractIT extends IntegrationTestBase {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path BASELINE = Path.of("src/test/resources/openapi-baseline.json");

    @Test
    void apiDocsMatchBaseline() throws Exception {
        var r = api.get("/v3/api-docs", null);
        assertEquals(200, r.status());
        ObjectNode doc = (ObjectNode) r.json();
        doc.remove("servers"); // contains the random test port
        if ("true".equals(System.getenv("OPENAPI_REGEN"))) {
            Files.writeString(BASELINE, JSON.writerWithDefaultPrettyPrinter().writeValueAsString(doc));
            return;
        }
        JsonNode baseline = JSON.readTree(Files.readString(BASELINE));
        assertEquals(baseline.path("paths").size(), doc.path("paths").size(), "path count");
        assertEquals(baseline.path("paths"), doc.path("paths"), "paths/operations");
        assertEquals(baseline.path("components"), doc.path("components"), "schemas");
        assertEquals(baseline, doc);
    }
}

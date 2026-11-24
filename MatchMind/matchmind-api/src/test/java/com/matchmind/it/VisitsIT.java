package com.matchmind.it;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

class VisitsIT extends IntegrationTestBase {
    private static final String CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

    private int visit(String body, String country) throws Exception {
        return mvc.perform(post("/api/v1/visits").contentType(MediaType.APPLICATION_JSON).content(body)
                .header("CF-IPCountry", country).header("User-Agent", CHROME))
            .andReturn().getResponse().getStatus();
    }

    @Test
    void anonymousVisitsAreRecordedOncePerHalfHourAndGroupedByCountryForAdminsOnly() throws Exception {
        assertThat(visit("{\"ip\":\"203.0.113.7\"}", "VN")).isEqualTo(204);
        assertThat(visit("{\"ip\":\"203.0.113.7\"}", "VN")).isEqualTo(204);   // same visitor again: not a new row
        assertThat(visit("{\"ip\":\"203.0.113.8\"}", "VN")).isEqualTo(204);
        assertThat(visit("{\"ip\":\"198.51.100.1\"}", "jp<script>")).isEqualTo(204); // unreadable country header
        assertThat(visit("{\"ip\":\"not-an-ip\"}", "VN")).isEqualTo(400);
        assertThat(visit("{\"ip\":\"203.0.113.9\",\"extra\":1}", "VN")).isEqualTo(400);

        var countries = adminGet("/api/v1/visits/countries");
        var vn = countries.findValues("country").stream().map(n -> n.asText()).toList();
        assertThat(vn).contains("VN", "XX");
        var vnRow = java.util.stream.StreamSupport.stream(countries.spliterator(), false)
            .filter(n -> n.path("country").asText().equals("VN")).findFirst().orElseThrow();
        assertThat(vnRow.path("visits").asInt()).isEqualTo(2);
        assertThat(vnRow.path("uniqueIps").asInt()).isEqualTo(2);

        var page = adminGet("/api/v1/visits?country=VN");
        assertThat(page.at("/meta/size").asInt()).isEqualTo(100);
        assertThat(page.at("/meta/totalElements").asInt()).isEqualTo(2);
        var first = page.at("/data/0");
        assertThat(first.path("ip").asText()).isEqualTo("203.0.113.8");
        assertThat(first.path("browser").asText()).isEqualTo("Chrome");
        assertThat(first.path("os").asText()).isEqualTo("Windows");

        adminPost("/api/v1/users", Map.of("username", "visitviewer", "password", "viewer-password-34", "role", "VIEWER"));
        String viewer = login("visitviewer", "viewer-password-34");
        assertThat(mvc.perform(get("/api/v1/visits/countries").header("Authorization", "Bearer " + viewer))
            .andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(get("/api/v1/visits")).andReturn().getResponse().getStatus()).isEqualTo(401);
    }
}

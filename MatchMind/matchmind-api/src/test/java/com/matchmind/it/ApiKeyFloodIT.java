package com.matchmind.it;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** UX-073: junk-key floods get a 429 and cannot grow the audit table one row per request. Own context: tiny limit. */
@TestPropertySource(properties = {"app.external-rate-limit.max-rejected-per-ip=5", "app.external-rate-limit.window=PT10M"})
class ApiKeyFloodIT extends IntegrationTestBase {

    @Test
    void wrongKeysAreThrottledPerIpAndWriteAtMostOneAuditRow() throws Exception {
        String ip = "198.51.100.77";
        int tooMany = 0;
        for (int i = 0; i < 20; i++) {
            MvcResult res = externalWith(Map.of("X-Api-Key", "wrong-" + i, "X-Provider", "flood-agent", "X-Forwarded-For", ip),
                "predictions", "{}");
            int status = res.getResponse().getStatus();
            if (status == 429) {
                tooMany++;
                assertThat(res.getResponse().getHeader("Retry-After")).isNotBlank();
                assertThat(read(res).get("code").asText()).isEqualTo("RATE_LIMITED");
            } else {
                assertThat(status).isEqualTo(401);
            }
        }
        assertThat(tooMany).isEqualTo(15);
        assertThat(db.queryForObject("SELECT count(*) FROM external_api_requests WHERE client_ip = ?", Integer.class, ip))
            .as("one sampled row per IP per window").isEqualTo(1);

        // Another address is unaffected, and so is a caller with the right key from the throttled one.
        assertThat(externalWith(Map.of("X-Api-Key", "wrong", "X-Provider", "flood-agent", "X-Forwarded-For", "198.51.100.78"),
            "predictions", "{}").getResponse().getStatus()).isEqualTo(401);
        MvcResult ok = externalWith(Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", "flood-agent", "X-Forwarded-For", ip),
            "predictions", "{}");
        assertThat(ok.getResponse().getStatus()).isEqualTo(400); // reaches validation: the key was accepted
    }
}

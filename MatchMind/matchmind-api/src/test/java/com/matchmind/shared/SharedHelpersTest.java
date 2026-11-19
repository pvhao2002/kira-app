package com.matchmind.shared;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SharedHelpersTest {
    private final ClientIpResolver ips = new ClientIpResolver("172.16.0.0/12");

    private String resolve(String peer, String forwardedFor) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr(peer);
        if (forwardedFor != null) req.addHeader("X-Forwarded-For", forwardedFor);
        return ips.resolve(req);
    }

    @Test
    void forwardedForIsOnlyTrustedFromConfiguredProxies() {
        assertThat(resolve("172.18.0.5", "203.0.113.7")).isEqualTo("203.0.113.7");
        // Untrusted peer: a spoofed header is ignored.
        assertThat(resolve("198.51.100.9", "203.0.113.7")).isEqualTo("198.51.100.9");
        // Walk right-to-left through trusted hops only; the client-supplied left part cannot win.
        assertThat(resolve("172.18.0.5", "1.2.3.4, 203.0.113.7")).isEqualTo("203.0.113.7");
        assertThat(resolve("172.18.0.5", "203.0.113.7, 172.18.0.9")).isEqualTo("203.0.113.7");
        // Garbage in the chain falls back to the peer.
        assertThat(resolve("172.18.0.5", "not-an-ip")).isEqualTo("172.18.0.5");
    }

    @Test
    void csvNeutralisesFormulasAndQuotes() {
        String csv = new String(TableExport.csv(List.of("a", "b", "c"),
            List.of(Arrays.asList("=1+1", "say \"hi\"", -3), Arrays.asList("@cmd", null, "-x"))), StandardCharsets.UTF_8);
        String[] lines = csv.substring(1).split("\r\n"); // skip the BOM
        assertThat(lines[1]).isEqualTo("\"'=1+1\",\"say \"\"hi\"\"\",\"-3\"");
        assertThat(lines[2]).isEqualTo("\"'@cmd\",,\"'-x\"");
    }
}

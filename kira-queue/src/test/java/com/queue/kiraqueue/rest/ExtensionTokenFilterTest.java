package com.queue.kiraqueue.rest;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class ExtensionTokenFilterTest {
    private static String sha(String s) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
    }

    private MockHttpServletResponse call(String expectedHash, String header, FilterChain chain) throws Exception {
        var req = new MockHttpServletRequest("GET", "/ext/x");
        if (header != null) {
            req.addHeader("Authorization", header);
        }
        var res = new MockHttpServletResponse();
        new ExtensionTokenFilter(expectedHash).doFilter(req, res, chain);
        return res;
    }

    @Test
    void missingTokenIs401() throws Exception {
        var chain = mock(FilterChain.class);
        assertThat(call(sha("t"), null, chain).getStatus()).isEqualTo(401);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void wrongTokenIs401() throws Exception {
        assertThat(call(sha("t"), "Bearer other", mock(FilterChain.class)).getStatus()).isEqualTo(401);
    }

    @Test
    void emptyEnvIs401() throws Exception {
        assertThat(call("", "Bearer t", mock(FilterChain.class)).getStatus()).isEqualTo(401);
        assertThat(call(null, "Bearer t", mock(FilterChain.class)).getStatus()).isEqualTo(401);
    }

    @Test
    void correctTokenPasses() throws Exception {
        var chain = mock(FilterChain.class);
        var res = call(sha("t"), "Bearer t", chain);
        assertThat(res.getStatus()).isEqualTo(200);
        verify(chain).doFilter(any(), any());
    }

    @Test
    void oversizedBodyIs413() throws Exception {
        var req = new MockHttpServletRequest("POST", "/ext/x") {
            @Override
            public long getContentLengthLong() {
                return ExtensionTokenFilter.MAX_BODY_BYTES + 1;
            }
        };
        req.addHeader("Authorization", "Bearer t");
        var res = new MockHttpServletResponse();
        var chain = mock(FilterChain.class);
        new ExtensionTokenFilter(sha("t")).doFilter(req, res, chain);
        assertThat(res.getStatus()).isEqualTo(413);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void registeredOnlyForExt() {
        var reg = new ExtensionTokenFilter.Registration().extensionTokenFilterRegistration("");
        assertThat(reg.getUrlPatterns()).containsExactly("/ext/*");
    }
}

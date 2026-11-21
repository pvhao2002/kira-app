package com.matchmind.security;

import com.matchmind.external.ExternalAuditService;
import com.matchmind.provider.ProviderKeyService;
import com.matchmind.provider.ProviderService;
import com.matchmind.shared.ClientIpResolver;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/** EXTERNAL_API_KEY is optional: without it the app starts and the legacy shared-key path answers 401. */
class ApiKeyAuthenticationFilterTest {
    private static ApiKeyAuthenticationFilter filter(String key) {
        return new ApiKeyAuthenticationFilter(key, mock(ProviderService.class), mock(ProviderKeyService.class),
            mock(ExternalAuditService.class), new ApiKeyFailureThrottle(30, Duration.ofMinutes(1)),
            new ClientIpResolver("127.0.0.1/32"));
    }

    @Test
    void unsetSharedKeyStartsAndRejectsTheOldKey() throws Exception {
        ApiKeyAuthenticationFilter f = filter("");
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/external/predictions");
        req.addHeader(ApiKeyAuthenticationFilter.HEADER, "test-external-key-0123456789-abcdefghij");
        req.addHeader(ApiKeyAuthenticationFilter.PROVIDER_HEADER, "acme");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        f.doFilter(req, res, chain);
        assertThat(res.getStatus()).isEqualTo(401);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void aSetSharedKeyMustBeLong() {
        assertThatThrownBy(() -> filter("too-short")).isInstanceOf(IllegalStateException.class);
        filter(null);
    }
}

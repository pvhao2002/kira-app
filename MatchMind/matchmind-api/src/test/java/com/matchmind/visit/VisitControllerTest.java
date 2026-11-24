package com.matchmind.visit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VisitControllerTest {
    @Test
    void namesBrowserAndOsFromTheUserAgent() {
        assertThat(VisitController.browser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0")).isEqualTo("Edge");
        assertThat(VisitController.browser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 OPR/114.0")).isEqualTo("Opera");
        assertThat(VisitController.browser("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15")).isEqualTo("Safari");
        assertThat(VisitController.browser("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0")).isEqualTo("Firefox");
        assertThat(VisitController.browser("curl/8.4")).isEqualTo("Other");
        assertThat(VisitController.browser(null)).isEqualTo("Other");
        assertThat(VisitController.os("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).isEqualTo("iOS");
        assertThat(VisitController.os("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).isEqualTo("Android");
        assertThat(VisitController.os("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)")).isEqualTo("macOS");
        assertThat(VisitController.os("Mozilla/5.0 (X11; Linux x86_64)")).isEqualTo("Linux");
        assertThat(VisitController.os(null)).isEqualTo("Other");
    }
}

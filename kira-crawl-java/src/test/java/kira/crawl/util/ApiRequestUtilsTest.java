package kira.crawl.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ApiRequestUtilsTest {

    @Test
    void stripTrailingSlashRemovesOnlyOneTrailingSlash() {
        assertEquals("https://example.com/api", ApiRequestUtils.stripTrailingSlash("https://example.com/api/"));
        assertEquals("https://example.com/api", ApiRequestUtils.stripTrailingSlash("https://example.com/api"));
    }

    @Test
    void stripTrailingSlashHandlesNullAndEmpty() {
        assertNull(ApiRequestUtils.stripTrailingSlash(null));
        assertEquals("", ApiRequestUtils.stripTrailingSlash(""));
    }

    @Test
    void joinPathBuildsUrlForAbsoluteAndRelativePaths() {
        assertEquals("https://example.com/api/matches", ApiRequestUtils.joinPath("https://example.com/api/", "/matches"));
        assertEquals("https://example.com/api/matches", ApiRequestUtils.joinPath("https://example.com/api", "matches"));
    }

    @Test
    void joinPathHandlesMissingSegments() {
        assertEquals("https://example.com/api", ApiRequestUtils.joinPath("https://example.com/api", ""));
        assertEquals("/matches", ApiRequestUtils.joinPath(null, "/matches"));
    }
}

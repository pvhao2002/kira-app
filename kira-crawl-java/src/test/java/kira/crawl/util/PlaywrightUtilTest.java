package kira.crawl.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlaywrightUtilTest {

    @Test
    void defaultContextPoolSizeIsTwo() {
        assertEquals(2, PlaywrightUtil.contextPoolSize());
    }

    @Test
    void leanNetworkBlocksHeavyAssetTypes() {
        assertTrue(PlaywrightRuntime.shouldBlockResourceType("image"));
        assertTrue(PlaywrightRuntime.shouldBlockResourceType("font"));
        assertTrue(PlaywrightRuntime.shouldBlockResourceType("media"));
    }

    @Test
    void leanNetworkAllowsScriptsAndDocuments() {
        assertFalse(PlaywrightRuntime.shouldBlockResourceType("document"));
        assertFalse(PlaywrightRuntime.shouldBlockResourceType("script"));
        assertFalse(PlaywrightRuntime.shouldBlockResourceType("xhr"));
        assertFalse(PlaywrightRuntime.shouldBlockResourceType("fetch"));
        assertFalse(PlaywrightRuntime.shouldBlockResourceType("stylesheet"));
    }
}

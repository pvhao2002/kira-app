package kira.crawl.browser;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microsoft.playwright.Page;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.protobuf.AiscoreProtobufService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiscoreMatchPageReaderTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void readMatchPageInfoUsesPrefetchedDetailBodyWithoutExtraFetch() {
        var pageFetchClient = mock(AiscorePageFetchClient.class);
        var protobufService = mock(AiscoreProtobufService.class);
        var properties = mock(PlaywrightProperties.class);
        var page = mock(Page.class);
        when(page.isClosed()).thenReturn(false);
        when(page.url()).thenReturn("https://www.aiscore.com/");

        var matchNode = matchNode(8, List.of(2, 1), List.of(0, 0));
        var webMatchData = OBJECT_MAPPER.createObjectNode().set("match", matchNode);
        when(protobufService.decodeWebMatchData(any())).thenReturn(webMatchData);

        var reader = new AiscoreMatchPageReader(pageFetchClient, protobufService, properties);

        var info = reader.readMatchPageInfo(page, "abc123", new byte[128]);

        assertEquals("FT", info.status());
        assertEquals(8, info.statusId());
        assertEquals(List.of(2, 1), info.homeScores());
        assertEquals(List.of(0, 0), info.awayScores());
        verify(pageFetchClient, never()).fetchOptional(any(), anyString(), anyString());
    }

    @Test
    void readMatchPageInfoFetchesWhenPrefetchedBodyMissing() {
        var pageFetchClient = mock(AiscorePageFetchClient.class);
        var protobufService = mock(AiscoreProtobufService.class);
        var properties = mock(PlaywrightProperties.class);
        var page = mock(Page.class);
        when(page.isClosed()).thenReturn(false);
        when(page.url()).thenReturn("https://www.aiscore.com/");

        var matchNode = matchNode(3, List.of(1, 0), List.of(1, 0));
        var webMatchData = OBJECT_MAPPER.createObjectNode().set("match", matchNode);
        when(pageFetchClient.fetchOptional(eq(page), anyString(), anyString())).thenReturn(new byte[128]);
        when(protobufService.decodeWebMatchData(any())).thenReturn(webMatchData);

        var reader = new AiscoreMatchPageReader(pageFetchClient, protobufService, properties);

        var info = reader.readMatchPageInfo(page, "abc123", null);

        assertEquals("3", info.status());
        assertTrue(info.hasScores());
        verify(pageFetchClient).fetchOptional(eq(page), anyString(), eq("https://www.aiscore.com/match/abc123"));
    }

    @Test
    void isSameMatchPageComparesNormalizedPath() {
        var page = mock(Page.class);
        when(page.isClosed()).thenReturn(false);
        when(page.url()).thenReturn("https://www.aiscore.com/match/m1/");

        assertTrue(AiscoreMatchPageReader.isSameMatchPage(page, "https://www.aiscore.com/match/m1"));
    }

    @Test
    void buildMatchPageRefererAndDetailUrl() {
        assertEquals("https://www.aiscore.com/match/m1", AiscoreMatchPageReader.buildMatchPageReferer("m1"));
        assertEquals(
                "https://api.aiscore.com/v1/web/api/match/detail?match_id=m1&lang=2",
                AiscoreMatchPageReader.buildMatchDetailApiUrl("m1")
        );
    }

    private static ObjectNode matchNode(int statusId, List<Integer> homeScores, List<Integer> awayScores) {
        var node = OBJECT_MAPPER.createObjectNode();
        node.put("statusId", statusId);
        node.set("homeScores", OBJECT_MAPPER.valueToTree(homeScores));
        node.set("awayScores", OBJECT_MAPPER.valueToTree(awayScores));
        return node;
    }
}

package com.queue.kiraqueue.crawl;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.queue.kiraqueue.browser.AiscorePageFetchClient;
import com.queue.kiraqueue.config.BusinessException;
import com.queue.kiraqueue.mapper.OddsMapper;
import com.microsoft.playwright.Page;
import com.queue.kiraqueue.playwright.PlaywrightLane;
import com.queue.kiraqueue.playwright.PlaywrightManager;
import com.queue.kiraqueue.protobuf.AiscoreProtobufService;
import com.queue.kiraqueue.service.CrawEventServiceV2;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventCrawlServiceMapOddsTest {
    private final AiscoreProtobufService proto = mock(AiscoreProtobufService.class);
    private final OddsMapper oddsMapper = mock(OddsMapper.class);
    private final PlaywrightManager playwrightManager = mock(PlaywrightManager.class);
    private final AiscorePageFetchClient fetchClient = mock(AiscorePageFetchClient.class);
    private final EventCrawlService service = new EventCrawlService(playwrightManager, fetchClient, proto, oddsMapper);
    private final byte[] bytes = {1};
    private final byte[] asia = {2};
    private final byte[] bs = {3};
    private final byte[] corner = {4};

    @Test
    void noBet365ReturnsEmpty() {
        var node = JsonNodeFactory.instance.objectNode();
        when(proto.decodeMatchOdds(any())).thenReturn(node);
        when(oddsMapper.hasBet365Company(node)).thenReturn(false);

        assertThat(service.mapOdds("m1", bytes, Map.of()).isEmpty()).isTrue();
    }

    @Test
    void missingRequiredDetailTabThrows() {
        var node = JsonNodeFactory.instance.objectNode();
        when(proto.decodeMatchOdds(any())).thenReturn(node);
        when(oddsMapper.hasBet365Company(node)).thenReturn(true);

        assertThatThrownBy(() -> service.mapOdds("m1", bytes, Map.of("asia", bytes)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("AISCORE_ODDS_DETAIL_FETCH_FAILED");
    }

    @Test
    void nullDetailsThrows() {
        stubBet365();

        assertThatThrownBy(() -> service.mapOdds("m1", bytes, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("AISCORE_ODDS_DETAIL_FETCH_FAILED");
    }

    @Test
    void mapsWithoutCornerWhenCornerAbsent() {
        stubBet365();
        var asiaNode = stubDetail(asia, "asia");
        var bsNode = stubDetail(bs, "bs");

        var result = service.mapOdds("m1", bytes, Map.of("asia", asia, "bs", bs));

        assertThat(result.isEmpty()).isFalse();
        assertThat(result.matchId()).isEqualTo("m1");
        assertThat(capturedDetails()).isEqualTo(new OddsMapper.OddsDetails(asiaNode, null, bsNode, null));
    }

    @Test
    void decodesCornerWhenPresent() {
        stubBet365();
        var asiaNode = stubDetail(asia, "asia");
        var bsNode = stubDetail(bs, "bs");
        var cornerNode = stubDetail(corner, "corner");

        service.mapOdds("m1", bytes, Map.of("asia", asia, "bs", bs, "corner", corner));

        assertThat(capturedDetails()).isEqualTo(new OddsMapper.OddsDetails(asiaNode, null, bsNode, cornerNode));
    }

    @Test
    void crawlEventFetchesAllTabsWhenCornerRequired() {
        var page = stubLane();
        stubBet365();
        stubFetch(page, "odds_list", bytes);
        stubFetch(page, "odds_type=asia", asia);
        stubFetch(page, "odds_type=bs", bs);
        stubFetch(page, "odds_type=corner", corner);
        var asiaNode = stubDetail(asia, "asia");
        var bsNode = stubDetail(bs, "bs");
        var cornerNode = stubDetail(corner, "corner");

        var result = service.crawlEvent("m1", event(true));

        assertThat(result.matchId()).isEqualTo("m1");
        assertThat(capturedDetails()).isEqualTo(new OddsMapper.OddsDetails(asiaNode, null, bsNode, cornerNode));
    }

    @Test
    void crawlEventSkipsCornerWhenNotRequired() {
        var page = stubLane();
        stubBet365();
        stubFetch(page, "odds_list", bytes);
        stubFetch(page, "odds_type=asia", asia);
        stubFetch(page, "odds_type=bs", bs);
        stubDetail(asia, "asia");
        stubDetail(bs, "bs");

        assertThat(service.crawlEvent("m1", event(false)).matchId()).isEqualTo("m1");
        verify(fetchClient, never()).fetchOptional(eq(page), contains("odds_type=corner"));
    }

    @Test
    void crawlEventThrowsWhenRequiredCornerFetchFails() {
        var page = stubLane();
        stubBet365();
        stubFetch(page, "odds_list", bytes);
        stubFetch(page, "odds_type=asia", asia);
        stubFetch(page, "odds_type=bs", bs);
        stubFetch(page, "odds_type=corner", null);
        stubDetail(asia, "asia");
        stubDetail(bs, "bs");

        assertThatThrownBy(() -> service.crawlEvent("m1", event(true)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("AISCORE_ODDS_DETAIL_FETCH_FAILED")
                .hasMessageContaining("type=corner");
        verify(oddsMapper, never()).mapOddsTimelineForDatabase(any());
    }

    private void stubBet365() {
        var node = JsonNodeFactory.instance.objectNode();
        when(proto.decodeMatchOdds(any())).thenReturn(node);
        when(oddsMapper.hasBet365Company(node)).thenReturn(true);
        when(oddsMapper.mapOddsTimelineForDatabase(any())).thenReturn(List.of());
        when(oddsMapper.mapOddsListForDatabase(node)).thenReturn(List.of());
    }

    private com.fasterxml.jackson.databind.JsonNode stubDetail(byte[] body, String tag) {
        var node = JsonNodeFactory.instance.objectNode().put("tab", tag);
        when(proto.decodeMatchOddsDetail(body)).thenReturn(node);
        return node;
    }

    private OddsMapper.OddsDetails capturedDetails() {
        var captor = ArgumentCaptor.forClass(OddsMapper.OddsDetails.class);
        verify(oddsMapper).mapOddsTimelineForDatabase(captor.capture());
        return captor.getValue();
    }

    @SuppressWarnings("unchecked")
    private Page stubLane() {
        var page = mock(Page.class);
        var lane = mock(PlaywrightLane.class);
        when(playwrightManager.getEventLane()).thenReturn(lane);
        when(lane.withPage(any())).thenAnswer(inv -> ((Function<Page, Object>) inv.getArgument(0)).apply(page));
        return page;
    }

    private void stubFetch(Page page, String urlPart, byte[] body) {
        when(fetchClient.fetchOptional(eq(page), contains(urlPart))).thenReturn(body);
    }

    private static CrawEventServiceV2.EventRow event(boolean hasOddsCorner) {
        return new CrawEventServiceV2.EventRow(1L, "link", true, hasOddsCorner, "-", 0, 0, "m1");
    }
}

package com.queue.kiraqueue.rest;

import com.queue.kiraqueue.crawl.DateCrawlService;
import com.queue.kiraqueue.crawl.EventCrawlService;
import com.queue.kiraqueue.dto.aiscore.CrawlEventDto;
import com.queue.kiraqueue.dto.aiscore.CrawledMatchBundleDto;
import com.queue.kiraqueue.dto.aiscore.MatchOddsResponseDto;
import com.queue.kiraqueue.dto.aiscore.MatchesResponseDto;
import com.queue.kiraqueue.service.CrawDateServiceV2;
import com.queue.kiraqueue.service.CrawEventServiceV2;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DeadlockLoserDataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ExtensionCrawlControllerTest {
    private final DateCrawlService dateCrawl = mock(DateCrawlService.class);
    private final EventCrawlService eventCrawl = mock(EventCrawlService.class);
    private final CrawDateServiceV2 dateV2 = mock(CrawDateServiceV2.class);
    private final CrawEventServiceV2 eventV2 = mock(CrawEventServiceV2.class);
    private final NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    private MockMvc mvc;
    private final String b64 = Base64.getEncoder().encodeToString(new byte[]{1, 2});

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ExtensionCrawlController(
                        dateCrawl, eventCrawl, dateV2, eventV2, jdbc))
                .setControllerAdvice(new RestExceptionHandler()).build();
    }

    @Test
    void badBase64Is400() throws Exception {
        mvc.perform(post("/ext/dates/20260101/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"***\"}"))
                .andExpect(status().isBadRequest());
        verify(dateV2, never()).persistDate(any(), any());
    }

    @Test
    void badDateIs400() throws Exception {
        mvc.perform(post("/ext/dates/2026-01-01/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + b64 + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void datesResponseIsCompact() throws Exception {
        var event = new CrawlEventDto("e1", null, null, null, "n", "2026-01-01T20:00:00+07:00",
                "NS", 1, "l", 1, true, false);
        var bundle = new CrawledMatchBundleDto(null, null, null, event, null);
        when(dateCrawl.mapMatches(eq("20260101"), any()))
                .thenReturn(new MatchesResponseDto("20260101", 1, 2, "07:00", 1, List.of(bundle), null));

        mvc.perform(post("/ext/dates/20260101/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + b64 + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].externalId").value("e1"))
                .andExpect(jsonPath("$[0].eventDate").value("2026-01-01T20:00:00+07:00"))
                .andExpect(jsonPath("$[0].statusId").value(1))
                .andExpect(jsonPath("$[0].hasOdds").value(true))
                .andExpect(jsonPath("$[0].hasOddsCorner").value(false))
                .andExpect(jsonPath("$[0].eventName").doesNotExist());
        verify(dateV2).persistDate(eq("20260101"), any());
    }

    @Test
    void noBet365WritesNothing() throws Exception {
        var row = new CrawEventServiceV2.EventRow(5L, "l/e1", true, false, "NS", 0, 0, "e1");
        when(eventV2.loadEventRowByExternalId("e1")).thenReturn(row);
        when(eventCrawl.mapOdds(eq("e1"), any(), any())).thenReturn(MatchOddsResponseDto.empty());

        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"oddsList\":\"" + b64 + "\",\"details\":{\"asia\":\"" + b64 + "\",\"bs\":\"" + b64 + "\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("no_bet365"));
        verify(eventV2, never()).persistCrawlResult(anyLong(), any());
    }

    private String oddsJson(String details) {
        return "{\"oddsList\":\"" + b64 + "\",\"details\":{" + details + "}}";
    }

    private String asiaBs() {
        return "\"asia\":\"" + b64 + "\",\"bs\":\"" + b64 + "\"";
    }

    private static MatchOddsResponseDto okResponse() {
        return new MatchOddsResponseDto("e1", null, null, List.of(), null, null);
    }

    private void rowWithCorner(boolean hasOddsCorner) {
        when(eventV2.loadEventRowByExternalId("e1"))
                .thenReturn(new CrawEventServiceV2.EventRow(5L, "l/e1", true, hasOddsCorner, "NS", 0, 0, "e1"));
    }

    @Test
    void oddsOkPersistsWithDbEventId() throws Exception {
        var resp = okResponse();
        rowWithCorner(false);
        when(eventCrawl.mapOdds(eq("e1"), any(), any())).thenReturn(resp);

        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON).content(oddsJson(asiaBs())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
        verify(eventV2).persistCrawlResult(5L, resp);
    }

    @Test
    void dbSaysCornerButBodyHasNoneKeepsExistingData() throws Exception {
        rowWithCorner(true);
        when(eventCrawl.mapOdds(eq("e1"), any(), any())).thenReturn(okResponse());

        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON).content(oddsJson(asiaBs())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("AISCORE_ODDS_DETAIL_FETCH_FAILED: corner"));
        verify(eventV2, never()).persistCrawlResult(anyLong(), any());
    }

    @Test
    void unknownEventIs404() throws Exception {
        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON).content(oddsJson(asiaBs())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("AISCORE_EVENT_NOT_FOUND"));
    }

    @Test
    void missingDetailsIs400() throws Exception {
        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"oddsList\":\"" + b64 + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invalidExternalIdIs400() throws Exception {
        mvc.perform(post("/ext/events/{id}/odds", "e!1").contentType(MediaType.APPLICATION_JSON)
                        .content(oddsJson(asiaBs())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("AISCORE_INVALID_EXTERNAL_ID"));
    }

    @Test
    void decodeErrorHidesOriginalMessage() throws Exception {
        rowWithCorner(false);
        when(eventCrawl.mapOdds(eq("e1"), any(), any())).thenThrow(new IllegalStateException("secret detail"));

        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON).content(oddsJson(asiaBs())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("AISCORE_DECODE_FAILED"));
    }

    @Test
    void dbErrorIsDomainCodeWithoutSql() throws Exception {
        rowWithCorner(false);
        when(eventCrawl.mapOdds(eq("e1"), any(), any())).thenReturn(okResponse());
        doThrow(new DataAccessResourceFailureException("delete from event_odds_timeline"))
                .when(eventV2).persistCrawlResult(anyLong(), any());

        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON).content(oddsJson(asiaBs())))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("AISCORE_PERSIST_FAILED"));
    }

    @Test
    void oddsDeadlockIsRetriedInNewTransaction() throws Exception {
        rowWithCorner(false);
        when(eventCrawl.mapOdds(eq("e1"), any(), any())).thenReturn(okResponse());
        doThrow(new DeadlockLoserDataAccessException("deadlock", null))
                .doNothing()
                .when(eventV2).persistCrawlResult(anyLong(), any());

        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON).content(oddsJson(asiaBs())))
                .andExpect(status().isOk());
        verify(eventV2, times(2)).persistCrawlResult(anyLong(), any());
    }

    @Test
    void persistDateLockFailureGivesUpAfterThreeAttempts() throws Exception {
        when(dateCrawl.mapMatches(eq("20260101"), any()))
                .thenReturn(new MatchesResponseDto("20260101", 1, 2, "07:00", 0, List.of(), null));
        doThrow(new CannotAcquireLockException("lock wait timeout"))
                .when(dateV2).persistDate(any(), any());

        mvc.perform(post("/ext/dates/20260101/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + b64 + "\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("AISCORE_PERSIST_FAILED"));
        verify(dateV2, times(3)).persistDate(any(), any());
    }

    @Test
    void malformedJsonIs400WithoutPayloadEcho() throws Exception {
        mvc.perform(post("/ext/events/e1/odds").contentType(MediaType.APPLICATION_JSON).content("{\"oddsList\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("AISCORE_INVALID_BODY"));
    }

    @Test
    void candidatesValidateDate() throws Exception {
        mvc.perform(get("/ext/odds/candidates").param("date", "bad")).andExpect(status().isBadRequest());
        mvc.perform(get("/ext/odds/candidates"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("AISCORE_INVALID_BODY"));
    }

    @Test
    void candidatesQueryOneLocalDay() throws Exception {
        var params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        when(jdbc.queryForList(anyString(), params.capture(), eq(String.class))).thenReturn(List.of("e1"));

        mvc.perform(get("/ext/odds/candidates").param("date", "20260131"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("e1"));
        assertThat(params.getValue().getValue("from")).isEqualTo(LocalDateTime.of(2026, 1, 31, 0, 0));
        assertThat(params.getValue().getValue("to")).isEqualTo(LocalDateTime.of(2026, 2, 1, 0, 0));
    }
}

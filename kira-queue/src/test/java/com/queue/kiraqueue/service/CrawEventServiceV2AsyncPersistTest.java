package com.queue.kiraqueue.service;

import com.queue.kiraqueue.crawl.EventCrawlService;
import com.queue.kiraqueue.dto.aiscore.CrawlOddsTimelineGroupDto;
import com.queue.kiraqueue.dto.aiscore.CrawlOddsTimelineItemDto;
import com.queue.kiraqueue.dto.aiscore.MatchOddsResponseDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CrawEventServiceV2AsyncPersistTest {

    private static final long EVENT_ID = 42L;
    private static final String LINK = "https://www.aiscore.com/match/home-away/m1";

    @Mock
    private NamedParameterJdbcTemplate jdbcTemplate;

    @Mock
    private EventCrawlService eventCrawlService;

    @Test
    void processEvent_fetchSuccess_persistsOddsTimeline() throws Exception {
        stubEventSelect();
        when(eventCrawlService.crawlEvent("m1"))
                .thenReturn(new MatchOddsResponseDto("m1", null, null, List.of(), null, null));

        var service = newService();
        assertTrue(service.processEvent(EVENT_ID));

        verify(jdbcTemplate).update(contains("event_odds_timeline"), anyMap());
    }

    @Test
    void processEvent_emptyOddsSnapshots_clearsHasOddsFlags() throws Exception {
        stubEventSelect();
        var timeline = new CrawlOddsTimelineGroupDto(
                List.of(new CrawlOddsTimelineItemDto(
                        "hdc", "-0.5#+0.5", "1.03", "0.87", "1'", "2015-01-01T19:15:00+07:00", null, null
                )),
                List.of(),
                List.of()
        );
        when(eventCrawlService.crawlEvent("m1"))
                .thenReturn(new MatchOddsResponseDto(
                        "vmqy9i4eeougk9r",
                        null,
                        null,
                        List.of(),
                        timeline,
                        null
                ));

        assertTrue(newService().processEvent(EVENT_ID));

        verify(jdbcTemplate).update(contains("has_odds = false"), eq(Map.of("event_id", EVENT_ID)));
    }

    @Test
    void processEvent_persistFailure_marksClaimFailed() throws Exception {
        stubEventSelect();
        when(eventCrawlService.crawlEvent("m1"))
                .thenReturn(new MatchOddsResponseDto("m1", null, null, List.of(), null, null));
        when(jdbcTemplate.update(anyString(), anyMap()))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0);
                    if (sql.contains("event_claim") && sql.contains("failed")) {
                        return 1;
                    }
                    throw new RuntimeException("db down");
                });

        assertFalse(newService().processEvent(EVENT_ID));

        verify(jdbcTemplate).update(contains("status = 'failed'"), eq(Map.of("event_id", EVENT_ID)));
    }

    private CrawEventServiceV2 newService() {
        return new CrawEventServiceV2(jdbcTemplate, eventCrawlService);
    }

    @SuppressWarnings("unchecked")
    private void stubEventSelect() throws SQLException {
        lenient().when(jdbcTemplate.query(anyString(), anyMap(), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper<Object> mapper = invocation.getArgument(2);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getLong("event_id")).thenReturn(EVENT_ID);
                    when(rs.getString("link")).thenReturn(LINK);
                    when(rs.getObject("has_odds_corner", Boolean.class)).thenReturn(false);
                    when(rs.getString("status")).thenReturn("FT");
                    when(rs.getInt("is_terminal")).thenReturn(1);
                    when(rs.getInt("is_in_play")).thenReturn(0);
                    return List.of(mapper.mapRow(rs, 0));
                });
    }
}

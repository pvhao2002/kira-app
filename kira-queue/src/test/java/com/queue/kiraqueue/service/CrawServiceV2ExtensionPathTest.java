package com.queue.kiraqueue.service;

import com.queue.kiraqueue.crawl.DateCrawlService;
import com.queue.kiraqueue.crawl.EventCrawlService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CrawServiceV2ExtensionPathTest {

    private final NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);

    @Test
    void persistDateWithNullEventsUpsertsRowThenMarksDoneWithZeroEvents() {
        var service = new CrawDateServiceV2(jdbc, mock(DateCrawlService.class), mock(AiscoreMatchStatusLabelCache.class));

        service.persistDate("20260101", null);

        InOrder order = inOrder(jdbc);
        order.verify(jdbc).update(
                argThat((String sql) -> sql.contains("insert into crawl_date")),
                argThat((SqlParameterSource p) -> "20260101".equals(p.getValue("date"))));
        var params = ArgumentCaptor.forClass(SqlParameterSource.class);
        order.verify(jdbc).update(argThat((String sql) -> sql.contains("update crawl_date")), params.capture());
        var p = (MapSqlParameterSource) params.getValue();
        assertThat(p.getValue("date")).isEqualTo("20260101");
        assertThat(p.getValue(CrawDateServiceV2.STATUS)).isEqualTo(CrawDateServiceV2.DONE);
        assertThat(p.getValue(CrawDateServiceV2.TOTAL_EVENTS)).isEqualTo(0);
    }

    @Test
    void persistDateRunsInOneTransaction() throws Exception {
        var method = CrawDateServiceV2.class.getMethod("persistDate", String.class, java.util.List.class);
        assertThat(method.isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)).isTrue();
    }

    @Test
    void persistDateUpsertsEventsSortedByExternalIdForStableLockOrder() {
        var service = new CrawDateServiceV2(jdbc, mock(DateCrawlService.class), mock(AiscoreMatchStatusLabelCache.class));

        service.persistDate("20260101", java.util.List.of(bundle("e2"), bundle("e1"), bundle("e3")));

        var batch = ArgumentCaptor.forClass(SqlParameterSource[].class);
        verify(jdbc).batchUpdate(argThat((String sql) -> sql.contains("insert into events")), batch.capture());
        assertThat(java.util.Arrays.stream(batch.getValue()).map(p -> p.getValue("exid")))
                .containsExactly("e1", "e2", "e3");
    }

    @Test
    void persistDateUpsertsTeamsSortedByName() {
        var service = new CrawDateServiceV2(jdbc, mock(DateCrawlService.class), mock(AiscoreMatchStatusLabelCache.class));
        var b = new com.queue.kiraqueue.dto.aiscore.CrawledMatchBundleDto(null, team("Zeta"), team("Alpha"),
                event("e1"), null);

        service.persistDate("20260101", java.util.List.of(b));

        var batch = ArgumentCaptor.forClass(SqlParameterSource[].class);
        verify(jdbc).batchUpdate(argThat((String sql) -> sql.contains("into teams")), batch.capture());
        assertThat(java.util.Arrays.stream(batch.getValue()).map(p -> p.getValue("team_name")))
                .containsExactly("Alpha", "Zeta");
    }

    @Test
    @SuppressWarnings("unchecked")
    void persistCrawlResultLocksEventRowBeforeTouchingOdds() {
        var service = new CrawEventServiceV2(jdbc, mock(EventCrawlService.class));

        service.persistCrawlResult(5L, new com.queue.kiraqueue.dto.aiscore.MatchOddsResponseDto(
                "e1", null, null, java.util.List.of(), null, null));

        InOrder order = inOrder(jdbc);
        order.verify(jdbc).queryForList(argThat((String sql) -> sql.contains("for update")),
                argThat((Map<String, ?> p) -> Long.valueOf(5L).equals(p.get("event_id"))), any(Class.class));
        order.verify(jdbc).update(argThat((String sql) -> sql.contains("delete from event_odds_timeline")), any(Map.class));
    }

    private static com.queue.kiraqueue.dto.aiscore.CrawledMatchBundleDto bundle(String exid) {
        return new com.queue.kiraqueue.dto.aiscore.CrawledMatchBundleDto(null, null, null, event(exid), null);
    }

    private static com.queue.kiraqueue.dto.aiscore.CrawlEventDto event(String exid) {
        return new com.queue.kiraqueue.dto.aiscore.CrawlEventDto(exid, null, null, null, "n",
                "2026-01-01T20:00:00+07:00", "NS", 1, "l", 1, true, false);
    }

    private static com.queue.kiraqueue.dto.aiscore.CrawlTeamDto team(String name) {
        return new com.queue.kiraqueue.dto.aiscore.CrawlTeamDto(null, name, null, 1);
    }

    @Test
    @SuppressWarnings("unchecked")
    void loadEventRowByExternalIdFiltersOnExternalId() {
        var service = new CrawEventServiceV2(jdbc, mock(EventCrawlService.class));

        assertThat(service.loadEventRowByExternalId("e1")).isNull();

        var sql = ArgumentCaptor.forClass(String.class);
        var params = ArgumentCaptor.forClass(Map.class);
        verify(jdbc).query(sql.capture(), params.capture(), any(RowMapper.class));
        assertThat(sql.getValue()).contains("where e.external_id = :externalId").doesNotContain(":eventId");
        assertThat(params.getValue()).containsEntry("externalId", "e1");
    }
}

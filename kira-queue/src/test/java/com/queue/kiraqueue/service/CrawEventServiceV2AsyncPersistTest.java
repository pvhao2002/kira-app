package com.queue.kiraqueue.service;

import com.queue.kiraqueue.client.KiraCrawlClient;
import com.queue.kiraqueue.dto.crawl.MatchOddsResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CrawEventServiceV2AsyncPersistTest {

    private static final long EVENT_ID = 42L;
    private static final String LINK = "http://example.com/match";

    @Mock
    private NamedParameterJdbcTemplate jdbcTemplate;

    @Mock
    private KiraCrawlClient kiraCrawlClient;

    @Mock
    private AiscoreMatchStatusLabelCache statusLabelCache;

    @Test
    void processEvent_fetchSuccess_returnsBeforePersistCompletes() throws Exception {
        stubEventSelect();
        when(kiraCrawlClient.fetchMatchOdds(LINK, false))
                .thenReturn(new MatchOddsResponse("m1", null, null, List.of(), null));

        var order = Collections.synchronizedList(new ArrayList<String>());
        var persistStarted = new CountDownLatch(1);
        var allowPersist = new CountDownLatch(1);

        Executor asyncExecutor = task -> new Thread(() -> {
            order.add("persist-started");
            persistStarted.countDown();
            try {
                allowPersist.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            task.run();
            order.add("persist-finished");
        }, "test-persist").start();

        var service = newService(asyncExecutor);
        boolean success = service.processEvent(EVENT_ID);
        order.add("process-returned");

        assertTrue(success);
        assertTrue(persistStarted.await(5, TimeUnit.SECONDS));
        assertTrue(order.contains("process-returned"));

        allowPersist.countDown();
        Thread.sleep(200);
        assertTrue(order.contains("persist-finished"), () -> "order=" + order);
        assertTrue(
                order.indexOf("process-returned") < order.indexOf("persist-finished"),
                () -> "processEvent should return before persist completes: order=" + order
        );

        verify(jdbcTemplate, timeout(5000).atLeastOnce())
                .update(contains("event_odds_timeline"), anyMap());
    }

    @Test
    void processEvent_persistFailure_marksClaimFailedAsync() throws Exception {
        stubEventSelect();
        when(kiraCrawlClient.fetchMatchOdds(LINK, false))
                .thenReturn(new MatchOddsResponse("m1", null, null, List.of(), null));
        when(jdbcTemplate.update(anyString(), anyMap()))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0);
                    if (sql.contains("event_claim") && sql.contains("failed")) {
                        return 1;
                    }
                    throw new RuntimeException("db down");
                });

        var service = newService(Runnable::run);
        assertTrue(service.processEvent(EVENT_ID));

        verify(jdbcTemplate, timeout(5000))
                .update(contains("status = 'failed'"), eq(Map.of("event_id", EVENT_ID)));
    }

    private CrawEventServiceV2 newService(Executor executor) {
        PlatformTransactionManager transactionManager = new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {
            }

            @Override
            public void rollback(TransactionStatus status) {
            }
        };
        return new CrawEventServiceV2(
                jdbcTemplate,
                kiraCrawlClient,
                executor,
                transactionManager,
                statusLabelCache
        );
    }

    @SuppressWarnings("unchecked")
    private void stubEventSelect() throws SQLException {
        lenient().when(jdbcTemplate.query(anyString(), anyMap(), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0);
                    RowMapper<Object> mapper = invocation.getArgument(2);
                    ResultSet rs = mock(ResultSet.class);
                    if (sql.contains("event_id, link, has_odds_corner")) {
                        when(rs.getLong("event_id")).thenReturn(EVENT_ID);
                        when(rs.getString("link")).thenReturn(LINK);
                        when(rs.getObject("has_odds_corner", Boolean.class)).thenReturn(false);
                    } else {
                        when(rs.getString("status")).thenReturn("FT");
                        when(rs.getInt("is_terminal")).thenReturn(1);
                        when(rs.getInt("is_in_play")).thenReturn(0);
                    }
                    return List.of(mapper.mapRow(rs, 0));
                });
    }
}

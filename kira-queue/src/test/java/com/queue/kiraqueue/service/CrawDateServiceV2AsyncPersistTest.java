package com.queue.kiraqueue.service;

import com.queue.kiraqueue.crawl.DateCrawlService;
import com.queue.kiraqueue.dto.aiscore.MatchesResponseDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CrawDateServiceV2AsyncPersistTest {

    @Mock
    private NamedParameterJdbcTemplate jdbcTemplate;

    @Mock
    private DateCrawlService dateCrawlService;

    @Mock
    private AiscoreMatchStatusLabelCache statusLabelCache;

    @Test
    void crawlDate_fetchSuccess_returnsBeforePersistStatusUpdate() throws InterruptedException {
        lenient().when(statusLabelCache.resolveStatus(any(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1) != null ? inv.getArgument(1) : "-");
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

        when(dateCrawlService.crawlDate("2025-05-25"))
                .thenReturn(new MatchesResponseDto("2025-05-25", 1, 2, "07:00", 0, List.of(), null));

        var service = new CrawDateServiceV2(jdbcTemplate, dateCrawlService, asyncExecutor, statusLabelCache);
        service.crawlDate(List.of("2025-05-25"));
        order.add("crawl-returned");

        assertTrue(persistStarted.await(5, TimeUnit.SECONDS));
        assertEquals(List.of("persist-started", "crawl-returned"), order);

        allowPersist.countDown();
        Thread.sleep(200);
        assertTrue(order.contains("persist-finished"), () -> "order=" + order);

        var paramsCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate, timeout(5000).atLeastOnce())
                .update(anyString(), paramsCaptor.capture());

        boolean hasDone = paramsCaptor.getAllValues().stream()
                .anyMatch(p -> CrawDateServiceV2.DONE.equals(p.getValue(CrawDateServiceV2.STATUS)));
        assertTrue(hasDone);
    }

    @Test
    void crawlDate_fetchFailure_marksFailedSynchronously() {
        Executor inlineExecutor = Runnable::run;
        lenient().when(statusLabelCache.resolveStatus(any(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1) != null ? inv.getArgument(1) : "-");
        when(dateCrawlService.crawlDate("2025-05-25"))
                .thenThrow(new IllegalStateException("crawl down"));

        var service = new CrawDateServiceV2(jdbcTemplate, dateCrawlService, inlineExecutor, statusLabelCache);
        service.crawlDate(List.of("2025-05-25"));

        var paramsCaptor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).update(anyString(), paramsCaptor.capture());

        boolean hasFailed = paramsCaptor.getAllValues().stream()
                .anyMatch(p -> CrawDateServiceV2.FAILED.equals(p.getValue(CrawDateServiceV2.STATUS)));
        assertTrue(hasFailed);
    }
}

package com.kira.affiliate.order.application;

import com.kira.affiliate.order.domain.SyncRun;
import com.kira.affiliate.order.infrastructure.ConversionStore;
import com.kira.affiliate.order.infrastructure.SyncRunRepository;
import com.kira.affiliate.shared.web.ApiException;
import com.kira.affiliate.shared.web.ApiTypes.PageResponse;
import com.kira.affiliate.shared.web.Paging;
import com.kira.affiliate.shopee.application.ShopeeCredentialService;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient.Credentials;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient.ReportPage;
import com.kira.affiliate.shopee.infrastructure.ShopeeApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Pulls Shopee reports into the local tables. One run per user at a time; all Shopee/DB work happens on a virtual
 * thread, never on a request or scheduler thread.
 */
@Service
public class SyncService {
    private static final Logger log = LoggerFactory.getLogger(SyncService.class);
    public static final String CONVERSIONS = "CONVERSIONS", VALIDATION = "VALIDATION";

    private final SyncRunRepository runs;
    private final ConversionStore store;
    private final ShopeeCredentialService credentials;
    private final ShopeeAffiliateClient client;
    private final int windowDays;
    private final int chunkDays;
    private final Duration freshQueryGap;

    // shortcut: in-flight guard and query pacing are per JVM; move to a DB lock (or ShedLock) before running 2+ instances.
    private final Set<Long> inFlight = ConcurrentHashMap.newKeySet();
    private final Map<Long, Instant> lastFreshQuery = new ConcurrentHashMap<>();
    private final AtomicBoolean scheduledPass = new AtomicBoolean();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public SyncService(SyncRunRepository runs, ConversionStore store, ShopeeCredentialService credentials,
                       ShopeeAffiliateClient client, @Value("${shopee.sync.window-days:30}") int windowDays,
                       @Value("${shopee.sync.chunk-days:30}") int chunkDays,
                       @Value("${shopee.sync.fresh-query-gap:31s}") Duration freshQueryGap) {
        this.runs = runs;
        this.store = store;
        this.credentials = credentials;
        this.client = client;
        this.windowDays = Math.max(1, windowDays);
        this.chunkDays = Math.max(1, chunkDays);
        this.freshQueryGap = freshQueryGap;
    }

    public record RunView(long id, String kind, String trigger, String status, Instant startedAt, Instant finishedAt,
                          int rowsUpserted, String errorCode, String errorMessage) {
    }

    public record StatusView(boolean running, RunView lastRun, Instant lastSuccessAt) {
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void failInterruptedRuns() {
        int failed = runs.failInterrupted(Instant.now());
        if (failed > 0) log.warn("marked {} interrupted sync run(s) as FAILED", failed);
    }

    /** Starts a run in the background and returns immediately. */
    public RunView start(Long userId, String kind, String trigger, Long validationId) {
        credentials.require(userId);
        SyncRun run = begin(userId, kind, trigger);
        executor.execute(() -> execute(userId, run.getId(), kind, validationId));
        return view(run);
    }

    /** Scheduled pass over every connected user, one after another, on the caller's (virtual) thread. */
    public void runScheduledPass() {
        if (!scheduledPass.compareAndSet(false, true)) return;
        try {
            for (Long userId : credentials.connectedUserIds()) {
                try {
                    SyncRun run = begin(userId, CONVERSIONS, "SCHEDULED");
                    execute(userId, run.getId(), CONVERSIONS, null);
                } catch (ApiException alreadyRunning) {
                    // A manual run for this user is in flight; it covers the same window.
                }
            }
        } finally {
            scheduledPass.set(false);
        }
    }

    public StatusView status(Long userId) {
        return new StatusView(inFlight.contains(userId),
            runs.findFirstByUserIdOrderByStartedAtDescIdDesc(userId).map(SyncService::view).orElse(null),
            runs.findFirstByUserIdAndStatusOrderByFinishedAtDesc(userId, "SUCCESS").map(SyncRun::getFinishedAt).orElse(null));
    }

    public PageResponse<RunView> history(Long userId, int page, int size) {
        Page<SyncRun> result = runs.findByUserIdOrderByStartedAtDescIdDesc(userId,
            PageRequest.of(Paging.page(page), Paging.size(size)));
        return Paging.response(result.map(SyncService::view).getContent(), result.getNumber(), result.getSize(),
            result.getTotalElements());
    }

    private SyncRun begin(Long userId, String kind, String trigger) {
        if (!inFlight.add(userId))
            throw new ApiException(HttpStatus.CONFLICT, "SYNC_RUNNING", "Đang đồng bộ, vui lòng chờ lượt hiện tại hoàn tất");
        try {
            SyncRun run = new SyncRun();
            run.setUserId(userId);
            run.setKind(kind);
            run.setTriggerType(trigger);
            run.setStatus("RUNNING");
            run.setStartedAt(Instant.now());
            return runs.save(run);
        } catch (RuntimeException ex) {
            inFlight.remove(userId);
            throw ex;
        }
    }

    private void execute(Long userId, Long runId, String kind, Long validationId) {
        int[] rows = {0};
        String status = "SUCCESS", errorCode = null, errorMessage = null;
        try {
            Credentials resolved = credentials.require(userId);
            if (VALIDATION.equals(kind)) pullValidation(userId, resolved, validationId, rows);
            else pullConversions(userId, resolved, rows);
            credentials.recordResult(userId, null);
        } catch (ShopeeApiException ex) {
            status = ex.getKind() == ShopeeApiException.Kind.RATE_LIMITED ? "RATE_LIMITED" : "FAILED";
            errorCode = "SHOPEE_" + ex.getCode();
            errorMessage = ex.userMessage();
            safely(() -> credentials.recordResult(userId, ex));
        } catch (ApiException ex) {
            status = "FAILED";
            errorCode = ex.getCode();
            errorMessage = ex.getMessage();
        } catch (RuntimeException ex) {
            log.error("sync failed userId={} runId={} kind={}", userId, runId, kind, ex);
            status = "FAILED";
            errorCode = "INTERNAL";
            errorMessage = "Lỗi hệ thống khi đồng bộ";
        } finally {
            String finalStatus = status, code = errorCode, message = errorMessage;
            safely(() -> runs.findById(runId).ifPresent(run -> {
                run.setStatus(finalStatus);
                run.setFinishedAt(Instant.now());
                run.setRowsUpserted(rows[0]);
                run.setErrorCode(code);
                run.setErrorMessage(message);
                runs.save(run);
            }));
            inFlight.remove(userId);
        }
    }

    private void pullConversions(Long userId, Credentials resolved, int[] rows) {
        Instant end = Instant.now();
        Instant start = end.minus(Duration.ofDays(windowDays));
        Duration chunk = Duration.ofDays(chunkDays);
        for (Instant from = start; from.isBefore(end); from = from.plus(chunk)) {
            Instant to = from.plus(chunk).isAfter(end) ? end : from.plus(chunk);
            String scrollId = null;
            do {
                if (scrollId == null) awaitFreshQuerySlot(userId);
                ReportPage page = client.conversionReport(resolved, from.getEpochSecond(), to.getEpochSecond(), scrollId);
                rows[0] += store.upsert(userId, page.nodes().stream().map(ConversionMapper::parse)
                    .filter(Objects::nonNull).toList());
                scrollId = next(page);
            } while (scrollId != null);
        }
    }

    private void pullValidation(Long userId, Credentials resolved, Long validationId, int[] rows) {
        Set<String> conversionIds = new HashSet<>();
        String scrollId = null;
        do {
            if (scrollId == null) awaitFreshQuerySlot(userId);
            ReportPage page = client.validatedReport(resolved, validationId, scrollId);
            page.nodes().forEach(node -> {
                String id = node.path("conversionId").asText("");
                if (!id.isBlank()) conversionIds.add(id);
            });
            scrollId = next(page);
        } while (scrollId != null);
        rows[0] = store.markValidated(userId, validationId, conversionIds);
    }

    private static String next(ReportPage page) {
        return page.hasNextPage() && !page.scrollId().isBlank() ? page.scrollId() : null;
    }

    /** Shopee rejects a report query without scrollId that follows the previous one too closely. */
    private void awaitFreshQuerySlot(Long userId) {
        Instant last = lastFreshQuery.get(userId);
        if (last != null) {
            Duration wait = Duration.between(Instant.now(), last.plus(freshQueryGap));
            if (wait.isPositive()) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new ShopeeApiException(0, "interrupted");
                }
            }
        }
        lastFreshQuery.put(userId, Instant.now());
    }

    private static void safely(Runnable action) {
        try {
            action.run();
        } catch (RuntimeException ex) {
            log.error("sync bookkeeping failed", ex);
        }
    }

    private static RunView view(SyncRun r) {
        return new RunView(r.getId(), r.getKind(), r.getTriggerType(), r.getStatus(), r.getStartedAt(),
            r.getFinishedAt(), r.getRowsUpserted(), r.getErrorCode(), r.getErrorMessage());
    }
}

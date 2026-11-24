package com.matchmind.prediction;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.security.SessionsRevoked;
import com.matchmind.shared.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

/**
 * Tells signed-in browsers that a new prediction was stored, over Server-Sent Events. The event carries only what a
 * toast needs; pages reload their own data through the normal API, so filters and permissions stay in one place.
 * <p>
 * A stream lives at most 30 minutes and never past its JWT; it ends at once when the user's session is revoked
 * (logout, disable, password change); one user holds at most 5 streams (the oldest is closed for a sixth) and the
 * server at most 200. Sending happens on virtual threads, never on the thread of the agent callback that stored the
 * prediction, and a browser that cannot keep up is dropped.
 */
@RestController
@Tag(name = "Live events")
public class PredictionEvents {
    /** The browser reconnects when a stream ends; a bounded life also re-checks the JWT at least this often. */
    private static final long STREAM_LIFETIME_MS = Duration.ofMinutes(30).toMillis();
    static final int MAX_STREAMS_PER_USER = 5;
    static final int MAX_STREAMS = 200;
    /** Unsent events a single slow browser may queue before it is dropped. */
    private static final int MAX_PENDING_PER_STREAM = 20;

    public record NewPrediction(UUID predictionId, UUID matchId, String homeTeam, String awayTeam, String model,
                                String predictionType) {
    }

    /** {@code admin}: only admins are told which model made the prediction. */
    private record Subscriber(SseEmitter emitter, UUID userId, UUID tokenId, boolean admin, AtomicInteger pending) {
    }

    // ponytail: in-memory subscriber list, fine for one API instance; use Postgres LISTEN/NOTIFY if the API scales out.
    private final List<Subscriber> streams = new CopyOnWriteArrayList<>();
    // ponytail: a write stuck in the servlet container holds its virtual thread until the container times it out.
    private final Executor sender = Executors.newVirtualThreadPerTaskExecutor();

    @GetMapping("/api/v1/events/predictions")
    @Operation(summary = "Stream of 'prediction' events, one per newly stored prediction")
    public ResponseEntity<SseEmitter> subscribe(@AuthenticationPrincipal UserPrincipal me) throws IOException {
        Subscriber sub = register(me);
        try {
            sub.emitter().send(SseEmitter.event().comment("connected")); // commits the headers now, not at the first event
        } catch (IOException | IllegalStateException e) {
            streams.remove(sub);
            throw e;
        }
        // nginx would otherwise buffer the stream and deliver events late, in batches.
        return ResponseEntity.ok().header("X-Accel-Buffering", "no").body(sub.emitter());
    }

    private synchronized Subscriber register(UserPrincipal me) {
        if (streams.size() >= MAX_STREAMS) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_STREAMS",
                "Too many live streams are open; try again shortly");
        }
        List<Subscriber> mine = streams.stream().filter(s -> s.userId().equals(me.id())).toList();
        for (int i = 0; i <= mine.size() - MAX_STREAMS_PER_USER; i++) close(mine.get(i)); // oldest first
        long lifetime = STREAM_LIFETIME_MS;
        if (me.tokenExpiresAt() != null) {
            lifetime = Math.max(1_000, Math.min(lifetime, Duration.between(Instant.now(), me.tokenExpiresAt()).toMillis()));
        }
        SseEmitter emitter = new SseEmitter(lifetime);
        Subscriber sub = new Subscriber(emitter, me.id(), me.tokenId(), "ADMIN".equals(me.role()), new AtomicInteger());
        emitter.onCompletion(() -> streams.remove(sub));
        emitter.onTimeout(emitter::complete);
        emitter.onError(e -> streams.remove(sub));
        streams.add(sub);
        return sub;
    }

    /** Ends the streams of a revoked session (or all of the user's sessions) now, not at the next ping. */
    @EventListener
    void onSessionsRevoked(SessionsRevoked revoked) {
        for (Subscriber s : streams) {
            if (s.userId().equals(revoked.userId()) && (revoked.tokenId() == null || revoked.tokenId().equals(s.tokenId()))) {
                close(s);
            }
        }
    }

    public void published(NewPrediction p) {
        NewPrediction anonymous = new NewPrediction(p.predictionId(), p.matchId(), p.homeTeam(), p.awayTeam(), null,
            p.predictionType());
        send(s -> SseEmitter.event().name("prediction").data(s.admin() ? p : anonymous));
    }

    /** Keeps idle streams open through proxies (nginx 60s, Cloudflare 100s) and drops browsers that left. */
    @Scheduled(fixedDelayString = "PT25S")
    void heartbeat() {
        send(s -> SseEmitter.event().comment("ping"));
    }

    public int openStreams() {
        return streams.size();
    }

    // An event builder is single-use, so each stream gets its own. A browser that left or fell behind is dropped and
    // never fails or slows the caller: the work runs on virtual threads.
    private void send(Function<Subscriber, SseEventBuilder> event) {
        for (Subscriber s : streams) {
            if (s.pending().incrementAndGet() > MAX_PENDING_PER_STREAM) {
                s.pending().decrementAndGet();
                close(s);
                continue;
            }
            sender.execute(() -> {
                try {
                    s.emitter().send(event.apply(s));
                } catch (IOException | IllegalStateException gone) {
                    streams.remove(s);
                } finally {
                    s.pending().decrementAndGet();
                }
            });
        }
    }

    private void close(Subscriber s) {
        if (streams.remove(s)) sender.execute(s.emitter()::complete); // complete() waits for a stuck write, so off-thread
    }
}

package com.matchmind.prediction;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Supplier;

/**
 * Tells signed-in browsers that a new prediction was stored, over Server-Sent Events. The event carries only what a
 * toast needs; pages reload their own data through the normal API, so filters and permissions stay in one place.
 */
@RestController
@Tag(name = "Live events")
public class PredictionEvents {
    /** The browser reconnects when a stream ends; a bounded life also re-checks the JWT at least this often. */
    private static final long STREAM_LIFETIME_MS = Duration.ofMinutes(30).toMillis();

    public record NewPrediction(UUID predictionId, UUID matchId, String homeTeam, String awayTeam, String model,
                                String predictionType) {
    }

    // ponytail: in-memory subscriber list, fine for one API instance; use Postgres LISTEN/NOTIFY if the API scales out.
    private final List<SseEmitter> streams = new CopyOnWriteArrayList<>();

    @GetMapping("/api/v1/events/predictions")
    @Operation(summary = "Stream of 'prediction' events, one per newly stored prediction")
    public ResponseEntity<SseEmitter> subscribe() throws IOException {
        SseEmitter stream = new SseEmitter(STREAM_LIFETIME_MS);
        stream.onCompletion(() -> streams.remove(stream));
        stream.onTimeout(stream::complete);
        stream.onError(e -> streams.remove(stream));
        stream.send(SseEmitter.event().comment("connected")); // commits the headers now, not at the first event
        streams.add(stream);
        // nginx would otherwise buffer the stream and deliver events late, in batches.
        return ResponseEntity.ok().header("X-Accel-Buffering", "no").body(stream);
    }

    public void published(NewPrediction p) {
        send(() -> SseEmitter.event().name("prediction").data(p));
    }

    /** Keeps idle streams open through proxies (nginx 60s, Cloudflare 100s) and drops browsers that left. */
    @Scheduled(fixedDelayString = "PT25S")
    void heartbeat() {
        send(() -> SseEmitter.event().comment("ping"));
    }

    // An event builder is single-use, so each stream gets its own. A browser that left is dropped, never fails the caller.
    // ponytail: sends on the caller's thread; a stalled browser can slow a provider callback, move to an executor if seen.
    private void send(Supplier<SseEventBuilder> event) {
        for (SseEmitter stream : streams) {
            try {
                stream.send(event.get());
            } catch (IOException | IllegalStateException gone) {
                streams.remove(stream);
            }
        }
    }
}

package com.kira.memory.message;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Server-sent events to every open tab: new messages and settings changes.
 * ponytail: in-memory fan-out, so it only reaches tabs connected to this instance; add Redis pub/sub if it scales out.
 */
@Component
public class LiveEvents {
    private final Set<SseEmitter> emitters = new CopyOnWriteArraySet<>();

    public SseEmitter connect() {
        // Browsers reconnect on their own; a bounded lifetime stops dead connections piling up.
        SseEmitter emitter = new SseEmitter(30 * 60_000L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(emitter::complete);
        emitter.onError(e -> emitters.remove(emitter));
        send(emitter, SseEmitter.event().name("ready").data("ok"));
        return emitter;
    }

    public void publish(String name, Object data) {
        emitters.forEach(e -> send(e, SseEmitter.event().name(name).data(data)));
    }

    @jakarta.annotation.PreDestroy
    void closeAll() {
        emitters.forEach(SseEmitter::complete);
    }

    /** Cloudflare and other proxies drop streams idle for ~100 s. */
    @Scheduled(fixedRate = 25_000)
    void heartbeat() {
        emitters.forEach(e -> send(e, SseEmitter.event().comment("ping")));
    }

    private void send(SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
        } catch (IOException | IllegalStateException e) {
            emitters.remove(emitter);
        }
    }
}

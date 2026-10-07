package com.kira.bank.notification.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.identity.application.JwtService;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.notification.infrastructure.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import static com.kira.bank.notification.application.NotificationDtos.NotificationChanged;
import static com.kira.bank.notification.application.NotificationDtos.NotificationResponse;

/**
 * Pushes {@code {unreadCount, notification}} to a user's open sockets. Browsers cannot send an Authorization header
 * on a WebSocket handshake and query strings end up in access logs, so the access token is the first text frame.
 * Sockets that do not authenticate within {@link #AUTH_TIMEOUT_SECONDS} are closed with 4401.
 */
@Slf4j
@Configuration(proxyBeanMethods = false)
@EnableWebSocket
@RequiredArgsConstructor
public class NotificationSocketHandler extends TextWebSocketHandler implements WebSocketConfigurer {
    public static final String PATH = "/api/v1/ws/notifications";
    private static final CloseStatus UNAUTHORIZED = new CloseStatus(4401, "UNAUTHORIZED");
    private static final long AUTH_TIMEOUT_SECONDS = 10;
    private static final String USER = "notification.userId";

    private final JwtService jwt;
    private final UserRepository users;
    private final NotificationRepository notifications;
    private final ObjectMapper json;
    // ponytail: in-memory registry, single service instance only; move to a broker relay if the API is scaled out.
    private final Map<Long, Map<String, WebSocketSession>> sessions = new ConcurrentHashMap<>();
    @Value("${app.cors-allowed-origins}")
    private String[] allowedOrigins;

    record Push(long unreadCount, NotificationResponse notification) {
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(this, PATH).setAllowedOrigins(allowedOrigins);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        CompletableFuture.delayedExecutor(AUTH_TIMEOUT_SECONDS, TimeUnit.SECONDS).execute(() -> {
            if (!session.getAttributes().containsKey(USER)) close(session);
        });
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        if (session.getAttributes().containsKey(USER)) return; // only the first frame (the token) is meaningful
        Long userId;
        try {
            userId = jwt.subject(message.getPayload());
        } catch (RuntimeException invalidToken) { // token value is never logged
            close(session);
            return;
        }
        if (users.findById(userId).filter(u -> "ACTIVE".equals(u.getStatus()) && u.getDeletedAt() == null).isEmpty()) {
            close(session);
            return;
        }
        // ponytail: an authenticated socket outlives the access token TTL; re-check on push if revocation matters.
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, 5_000, 64 * 1024);
        session.getAttributes().put(USER, userId);
        sessions.compute(userId, (id, open) -> {
            Map<String, WebSocketSession> map = open == null ? new ConcurrentHashMap<>() : open;
            map.put(session.getId(), safe);
            return map;
        });
        push(userId, List.of(safe), null);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        if (session.getAttributes().get(USER) instanceof Long userId) {
            sessions.computeIfPresent(userId, (id, open) -> {
                open.remove(session.getId());
                return open.isEmpty() ? null : open;
            });
        }
    }

    /** Runs after the creating/reading transaction commits; never throws back into the caller's flow. */
    @TransactionalEventListener(fallbackExecution = true)
    void onChanged(NotificationChanged event) {
        Map<String, WebSocketSession> open = sessions.get(event.userId());
        if (open != null) push(event.userId(), open.values(), event.created());
    }

    private void push(Long userId, Collection<WebSocketSession> targets, NotificationResponse created) {
        try {
            TextMessage body = new TextMessage(json.writeValueAsString(
                new Push(notifications.countByUserIdAndReadAtIsNullAndDeletedAtIsNull(userId), created)));
            for (WebSocketSession target : targets) {
                try {
                    target.sendMessage(body);
                } catch (IOException | RuntimeException sendFailed) {
                    log.debug("Notification push to a socket failed: {}", sendFailed.getClass().getSimpleName());
                }
            }
        } catch (IOException | RuntimeException failed) {
            log.warn("Notification push skipped: {}", failed.getClass().getSimpleName());
        }
    }

    private static void close(WebSocketSession session) {
        try {
            session.close(UNAUTHORIZED);
        } catch (IOException ignored) { /* already gone */ }
    }
}

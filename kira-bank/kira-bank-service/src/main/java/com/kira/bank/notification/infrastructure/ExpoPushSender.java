package com.kira.bank.notification.infrastructure;

import com.kira.bank.notification.domain.PushDevice;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static com.kira.bank.notification.application.NotificationDtos.NotificationChanged;
import static com.kira.bank.notification.application.NotificationDtos.NotificationResponse;

/**
 * Sends new notifications to the user's mobile devices through the Expo push service. Only the title and the
 * deep link leave the system (the message body may contain financial details). Runs after commit on its own
 * thread so the creating flow (AI queue, schedulers, imports) never waits on or fails because of Expo.
 */
@Slf4j
@Component
public class ExpoPushSender {
    private final PushDeviceRepository devices;
    private final RestClient http;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    record Ticket(String status, Map<String, Object> details) {
    }

    record Tickets(List<Ticket> data) {
    }

    ExpoPushSender(PushDeviceRepository devices, @Value("${app.push.expo-url}") String url,
                   @Value("${app.push.expo-access-token:}") String accessToken) {
        this.devices = devices;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(10));
        RestClient.Builder builder = RestClient.builder().requestFactory(requestFactory).baseUrl(url);
        if (!accessToken.isBlank()) builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
        this.http = builder.build();
    }

    @TransactionalEventListener(fallbackExecution = true)
    void onChanged(NotificationChanged event) {
        if (event.created() == null) return;
        try {
            executor.execute(() -> send(event.userId(), event.created()));
        } catch (RuntimeException rejected) { // shutting down
            log.debug("Push skipped: {}", rejected.getClass().getSimpleName());
        }
    }

    // ponytail: push tickets only; receipts are not polled, so late DeviceNotRegistered errors are missed until the next send.
    void send(Long userId, NotificationResponse notification) {
        try {
            List<PushDevice> targets = devices.findByUserId(userId);
            if (targets.isEmpty()) return;
            Map<String, Object> data = notification.deepLink() == null
                ? Map.of("notificationId", notification.id())
                : Map.of("notificationId", notification.id(), "deepLink", notification.deepLink());
            List<Map<String, Object>> messages = targets.stream().map(device -> Map.<String, Object>of(
                "to", device.getToken(), "title", notification.title(), "sound", "default", "data", data)).toList();
            Tickets tickets = http.post().contentType(MediaType.APPLICATION_JSON).body(messages).retrieve()
                .body(Tickets.class);
            if (tickets == null || tickets.data() == null) return;
            for (int i = 0; i < Math.min(targets.size(), tickets.data().size()); i++) {
                Ticket ticket = tickets.data().get(i);
                if ("error".equals(ticket.status()) && ticket.details() != null
                    && "DeviceNotRegistered".equals(ticket.details().get("error"))) {
                    devices.deleteByToken(targets.get(i).getToken());
                }
            }
        } catch (RuntimeException failed) { // tokens and payloads are never logged
            log.warn("Expo push failed: {}", failed.getClass().getSimpleName());
        }
    }

    @PreDestroy
    void shutdown() {
        executor.close();
    }
}

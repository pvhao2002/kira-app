package com.queue.kiraqueue.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queue.kiraqueue.config.RabbitMQConfig;
import com.queue.kiraqueue.dto.SettleJobMessage;
import com.queue.kiraqueue.prediction.PredictionSettleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "kira.queue.consumer.settle-enabled", havingValue = "true")
public class SettleConsumer {

    private final ObjectMapper objectMapper;
    private final PredictionSettleService predictionSettleService;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_PREDICTION_SETTLE, concurrency = "1")
    public void handleSettle(String payload) {
        long startedAt = System.currentTimeMillis();
        try {
            var eventId = parseEventId(payload);
            if (eventId == null) {
                log.warning("Settle job missing eventId: " + payload);
                return;
            }
            predictionSettleService.settleEvent(eventId);
        } catch (Exception ex) {
            log.log(Level.SEVERE, "Settle job failed for payload: " + payload, ex);
        } finally {
            log.fine(() -> "Settle job finished in " + (System.currentTimeMillis() - startedAt) + "ms");
        }
    }

    private Long parseEventId(String payload) {
        if (payload == null || payload.isBlank()) {
            return null;
        }
        var trimmed = payload.trim();
        if (trimmed.startsWith("{")) {
            try {
                return objectMapper.readValue(trimmed, SettleJobMessage.class).eventId();
            } catch (Exception ex) {
                log.warning("Failed to parse settle job JSON: " + ex.getMessage());
                return null;
            }
        }
        try {
            return Long.parseLong(trimmed);
        } catch (NumberFormatException ex) {
            log.warning("Invalid settle job payload: " + payload);
            return null;
        }
    }
}

package com.queue.kiraqueue.consumer;

import com.queue.kiraqueue.config.RabbitMQConfig;
import com.queue.kiraqueue.service.PredictService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "kira.queue.consumer.predict-enabled", havingValue = "true")
public class PredictConsumer {

    private final PredictService predictService;

    @RabbitListener(
            queues = RabbitMQConfig.QUEUE_PREDICTION,
            containerFactory = RabbitMQConfig.PREDICTION_LISTENER_CONTAINER_FACTORY
    )
    public void handlePredict(String payload) {
        long startedAt = System.currentTimeMillis();
        try {
            predictService.predict(payload);
        } catch (Exception ex) {
            log.log(Level.SEVERE, "Prediction job failed for payload: " + payload, ex);
        } finally {
            log.fine(() -> "Prediction job finished in " + (System.currentTimeMillis() - startedAt) + "ms");
        }
    }
}

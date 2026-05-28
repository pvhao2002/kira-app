package com.queue.kiraqueue.consumer;

import com.queue.kiraqueue.config.RabbitMQConfig;
import com.queue.kiraqueue.service.PredictService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class PredictConsumer {

    private final PredictService predictService;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_PREDICTION, concurrency = "1")
    public void handlePredict(String payload) {
        try {
            predictService.predict(payload);
        } catch (Exception ex) {
            log.severe("Prediction job failed: " + ex.getMessage());
        }
    }
}

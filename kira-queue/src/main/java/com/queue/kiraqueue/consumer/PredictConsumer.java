package com.queue.kiraqueue.consumer;

import com.queue.kiraqueue.service.PredictService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

@Log
@Service
@RequiredArgsConstructor
public class PredictConsumer {
    public static final String QUEUE_PREDICTION = "prediction";
    private final PredictService predictService;

    @RabbitListener(queues = QUEUE_PREDICTION, concurrency = "1")
    public void handlePredict(String eventId) {
        predictService.predict(eventId);
    }
}

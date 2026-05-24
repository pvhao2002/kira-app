package com.queue.kiraqueue.consumer;

import com.queue.kiraqueue.config.RabbitMQConfig;
import com.queue.kiraqueue.service.LogoUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LogoUploadConsumer {

    private final LogoUploadService logoUploadService;

//    @RabbitListener(queues = RabbitMQConfig.QUEUE_LOGO, concurrency = "1")
    public void handle(String payload) {
        logoUploadService.process(payload);
    }
}

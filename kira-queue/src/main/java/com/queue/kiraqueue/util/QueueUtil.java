package com.queue.kiraqueue.util;

import com.queue.kiraqueue.consumer.EventConsumer;
import lombok.experimental.UtilityClass;

import java.util.Map;

@UtilityClass
public class QueueUtil {
    private static final Map<String, Integer> QUEUE_BASE_INDEX = Map.of(
            EventConsumer.QUEUE_EVENT_ODD_TOMORROW, 2,
            EventConsumer.QUEUE_EVENT_ODD, 5
    );

    public int mapConsumerIndex(String queueName, String consumerTag) {
        int baseIndex = QUEUE_BASE_INDEX.getOrDefault(queueName, 0);
        return baseIndex + (Math.abs(consumerTag.hashCode()) % 2);
    }
}

package com.queue.kiraqueue.dto.model;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EventCrawlFailed {
    Long eventId;
    String message;
    String html;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}

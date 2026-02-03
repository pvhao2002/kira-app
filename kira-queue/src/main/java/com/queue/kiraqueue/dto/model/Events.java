package com.queue.kiraqueue.dto.model;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Events {
    Long eventId;
    String externalId;
    Integer LeagueId;
    Integer homeId;
    Integer awayId;
    String eventName;
    LocalDateTime eventDate;
    String status;
    String link;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}

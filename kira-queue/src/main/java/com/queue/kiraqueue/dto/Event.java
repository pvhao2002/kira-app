package com.queue.kiraqueue.dto;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Event {
    private Long eventId;
    private String eventName;
    private String eventDate;
    private String leagueName;
    private String detailLink;
}

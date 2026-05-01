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
    /** Match status from DB (e.g. FT) — drives stats vs odds-only crawl like kira-crawl. */
    private String status;
    private String eventDate;
    private String leagueName;
    private String detailLink;
    private String link;
}

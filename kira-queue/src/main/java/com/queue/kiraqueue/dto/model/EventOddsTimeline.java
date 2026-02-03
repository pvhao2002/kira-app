package com.queue.kiraqueue.dto.model;

import com.microsoft.playwright.ElementHandle;
import com.queue.kiraqueue.util.StringUtil;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@EqualsAndHashCode(callSuper = true)
@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EventOddsTimeline extends EventOdds {
    String matchMinute;
    LocalDateTime createdAt;
    // text
    String date;

    public EventOddsTimeline(ElementHandle li) {
        super(li);
        var allLineOdds = li.querySelectorAll(".firstSpan");
        if (allLineOdds.size() < 3) {
            date = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
        } else {
            matchMinute = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
        }
    }
}

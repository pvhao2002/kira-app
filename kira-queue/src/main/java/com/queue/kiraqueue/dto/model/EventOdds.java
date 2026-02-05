package com.queue.kiraqueue.dto.model;

import com.microsoft.playwright.ElementHandle;
import com.queue.kiraqueue.util.StringUtil;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PROTECTED)
public class EventOdds {
    Long oddsId;
    @With
    Long eventId;
    @With
    String type;
    @With
    String market;
    String line;
    BigDecimal priceA;
    BigDecimal priceB;
    LocalDateTime createdAt;

    public EventOdds(ElementHandle li, String market) {
    }
}

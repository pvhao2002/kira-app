package com.queue.kiraqueue.dto.model;

import com.microsoft.playwright.ElementHandle;
import com.queue.kiraqueue.util.StringUtil;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.stream.Collectors;

@EqualsAndHashCode(callSuper = true)
@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EventOddsTimeline extends EventOdds {
    String matchMinute;
    LocalDateTime createdAt;
    String date;

    public EventOddsTimeline(ElementHandle li, String market) {
        this.market = market;
        var allLineOdds = li.querySelectorAll(".firstSpan");
        if (allLineOdds.size() < 3) {
            date = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
        } else {
            matchMinute = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
        }
        var oddsBox = li.querySelectorAll(".oddsBox");
        if ("hdc".equalsIgnoreCase(market)) {
            li.waitForSelector(".oddsBox");
            this.line = oddsBox.stream().map(el -> {
                var hdcEle = el.querySelector(".handicap.handicapRight");
                return StringUtil.normalizeText(Optional.ofNullable(hdcEle).map(ElementHandle::textContent).orElse(null));
            }).filter(StringUtil::isNotEmpty).collect(Collectors.joining("#"));
            System.out.println("HDC Line: " + this.line);
        } else {
            this.line = StringUtil.normalizeText(oddsBox.getFirst().textContent());
            System.out.println("Line: " + this.line);
        }
    }
}

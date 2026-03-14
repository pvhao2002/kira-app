package com.queue.kiraqueue.dto.model;

import com.microsoft.playwright.ElementHandle;
import com.queue.kiraqueue.util.OddConverter;
import com.queue.kiraqueue.util.StringUtil;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
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

        var oddsBox = li.querySelectorAll(".oddsBox");
        if ("hdc".equalsIgnoreCase(market)) {
            if (allLineOdds.size() == 3) {
                date = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
            } else {
                matchMinute = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
            }
            li.waitForSelector(".oddsBox");
            this.line = oddsBox.stream().map(el -> {
                var hdcEle = el.querySelector(".handicap.handicapRight");
                return StringUtil.normalizeText(Optional.ofNullable(hdcEle).map(ElementHandle::textContent).orElse(null));
            }).filter(StringUtil::isNotEmpty).collect(Collectors.joining("#"));
        } else {
            if (allLineOdds.size() == 4) {
                date = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
            } else {
                matchMinute = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
            }
            this.line = oddsBox.isEmpty() ? null : StringUtil.normalizeText(oddsBox.getFirst().textContent());
        }
        parsePricesFromOddsBox(oddsBox);
    }

    private void parsePricesFromOddsBox(java.util.List<? extends ElementHandle> oddsBox) {
        if (oddsBox == null || oddsBox.size() < 2) return;
        var a = OddConverter.parse(StringUtil.normalizeText(oddsBox.get(oddsBox.size() - 2).textContent()));
        var b = OddConverter.parse(StringUtil.normalizeText(oddsBox.get(oddsBox.size() - 1).textContent()));
        if (a != null) setPriceA(BigDecimal.valueOf(a));
        if (b != null) setPriceB(BigDecimal.valueOf(b));
    }
}

package com.queue.kiraqueue.dto.model;

import com.microsoft.playwright.Locator;
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

    public EventOddsTimeline(Locator li, String market) {
        this.market = market;
        var allLineOdds = li.locator(".firstSpan");
        var oddsBox = li.locator(".oddsBox");
        if (StringUtil.normalizeText(oddsBox.all().stream().map(Locator::textContent).collect(Collectors.joining(" "))).isBlank()) {
            return;
        }
        var isHdc = "hdc".equalsIgnoreCase(market);
        if (isHdc) {
            if (allLineOdds.count() == 3) {
                date = StringUtil.normalizeText(allLineOdds.first().textContent());
            } else {
                matchMinute = StringUtil.normalizeText(allLineOdds.first().textContent());
            }
            this.line = oddsBox.all().stream().map(el -> {
                if (StringUtil.normalizeText(el.textContent()).isBlank()) {
                    return null;
                }
                var hdcEle = el.locator(".handicap.handicapRight");
                return StringUtil.normalizeText(Optional.ofNullable(hdcEle).map(Locator::textContent).orElse(null));
            }).filter(StringUtil::isNotEmpty).collect(Collectors.joining("#"));
        } else {
            if (allLineOdds.count() == 4) {
                date = StringUtil.normalizeText(allLineOdds.first().textContent());
            } else {
                matchMinute = StringUtil.normalizeText(allLineOdds.first().textContent());
            }
            this.line = oddsBox.count() == 0 ? null : StringUtil.normalizeText(oddsBox.first().textContent());
        }
        parsePricesFromOddsBox(oddsBox.all(), isHdc);
    }

    private void parsePricesFromOddsBox(java.util.List<? extends Locator> oddsBox, boolean isHdc) {
        if (oddsBox == null || oddsBox.isEmpty()) return;
        if (oddsBox.size() < 2) return;
        Double a;
        Double b;
        if (isHdc) {
            if (oddsBox.size() == 2) {
                a = parseHdcOddsText(oddsBox.getFirst());
                b = parseHdcOddsText(oddsBox.get(1));
            } else {
                var priceAElement = oddsBox.get(oddsBox.size() - 2);
                var priceBElement = oddsBox.getLast();
                a = parseHdcOddsText(priceAElement);
                b = parseHdcOddsText(priceBElement);
            }
        } else {
            a = OddConverter.parse(StringUtil.normalizeText(oddsBox.get(oddsBox.size() - 2).textContent()));
            b = OddConverter.parse(StringUtil.normalizeText(oddsBox.getLast().textContent()));
        }

        if (a != null) setPriceA(BigDecimal.valueOf(a));
        if (b != null) setPriceB(BigDecimal.valueOf(b));
    }

    private static Double parseHdcOddsText(Locator el) {
        if (el == null) return null;
        try {
            String raw = el.evaluate("node => { const h = node.querySelector('.handicap.handicapRight'); const t = (node.innerText || node.textContent || '').trim(); return h ? t.replace(h.textContent.trim(), '').trim() : t; }").toString();
            return OddConverter.parse(StringUtil.normalizeText(raw));
        } catch (Exception e) {
            return OddConverter.parse(StringUtil.normalizeText(el.textContent()));
        }
    }
}

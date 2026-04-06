package kira.crawl.app.dto;

import com.microsoft.playwright.ElementHandle;
import kira.crawl.app.util.OddConverter;
import kira.crawl.app.util.StringUtil;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.stream.Collectors;

@EqualsAndHashCode(callSuper = true)
@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EventOddsTimeline extends EventOdds {
    String matchMinute;
    String date;

    public EventOddsTimeline(ElementHandle li, String market) {
        this.market = market;
        var allLineOdds = li.querySelectorAll(".firstSpan");
        li.waitForSelector(".oddsBox");
        var oddsBox = li.querySelectorAll(".oddsBox");
        var isHdc = "hdc".equalsIgnoreCase(market);
        if (isHdc) {
            if (allLineOdds.size() == 3) {
                date = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
            } else {
                matchMinute = StringUtil.normalizeText(allLineOdds.getFirst().textContent());
            }
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
        parsePricesFromOddsBox(oddsBox, isHdc);
    }

    private void parsePricesFromOddsBox(java.util.List<? extends ElementHandle> oddsBox, boolean isHdc) {
        if (oddsBox == null || oddsBox.size() < 2) return;
        Double a = null;
        Double b = null;
        if (isHdc) {
            if (oddsBox.size() == 2) {
                a = parseHdcOddsText(oddsBox.getFirst());
                b = parseHdcOddsText(oddsBox.get(1));
            } else {
                a = parseHdcOddsText(oddsBox.get(oddsBox.size() - 2));
                b = parseHdcOddsText(oddsBox.getLast());
            }
        } else {
            a = OddConverter.parse(StringUtil.normalizeText(oddsBox.get(oddsBox.size() - 2).textContent()));
            b = OddConverter.parse(StringUtil.normalizeText(oddsBox.getLast().textContent()));
        }
        if (a != null) setPriceA(BigDecimal.valueOf(a));
        if (b != null) setPriceB(BigDecimal.valueOf(b));
    }

    private static Double parseHdcOddsText(ElementHandle el) {
        if (el == null) return null;
        try {
            String raw = el.evaluate(
                    "node => { const h = node.querySelector('.handicap.handicapRight'); " +
                    "const t = (node.innerText || node.textContent || '').trim(); " +
                    "return h ? t.replace(h.textContent.trim(), '').trim() : t; }"
            ).toString();
            return OddConverter.parse(StringUtil.normalizeText(raw));
        } catch (Exception e) {
            return OddConverter.parse(StringUtil.normalizeText(el.textContent()));
        }
    }

    public OddsTimelineItemDTO toDTO() {
        return new OddsTimelineItemDTO(line, priceA, priceB, matchMinute, date);
    }
}

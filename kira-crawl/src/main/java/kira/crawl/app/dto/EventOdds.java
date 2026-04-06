package kira.crawl.app.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PROTECTED)
public class EventOdds {
    Long eventId;
    String type;
    String market;
    String line;
    BigDecimal priceA;
    BigDecimal priceB;
}

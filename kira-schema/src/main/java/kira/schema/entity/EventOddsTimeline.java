package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import kira.schema.entity.enums.OddsMarket;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "event_odds_timeline",
        indexes = {
                @Index(name = "idx_event_market", columnList = "event_id, market"),
                @Index(name = "idx_event_market_crawled", columnList = "event_id, market, crawled_at"),
                @Index(name = "idx_event_market_line", columnList = "event_id, market, line"),
                @Index(name = "idx_event_odds_timeline_event_id", columnList = "event_id")
        })
@Getter
@Setter
@NoArgsConstructor
public class EventOddsTimeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "odds_id")
    private Long oddsId;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "enum('hdc','ou','corner')")
    private OddsMarket market;

    @Column(length = 25)
    private String line;

    @Column(name = "price_a", precision = 10, scale = 2)
    private BigDecimal priceA;

    @Column(name = "price_b", precision = 10, scale = 2)
    private BigDecimal priceB;

    @Column(name = "match_minute", length = 10)
    private String matchMinute;

    @Column(name = "crawled_at")
    private LocalDateTime crawledAt;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;
}

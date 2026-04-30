package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import kira.schema.entity.enums.OddsMarket;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "event_odds")
@Getter
@Setter
@NoArgsConstructor
public class EventOdds {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "odds_id")
    private Long oddsId;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    /**
     * MySQL enum includes {@code pre-match}; stored as string literal matching the DB enum.
     */
    @Column(name = "type", nullable = false, columnDefinition = "enum('open','pre-match','half-time')")
    private String phaseType;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "enum('hdc','ou','corner')")
    private OddsMarket market;

    @Column(length = 25)
    private String line;

    @Column(name = "price_a", precision = 10, scale = 2)
    private BigDecimal priceA;

    @Column(name = "price_b", precision = 10, scale = 2)
    private BigDecimal priceB;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}

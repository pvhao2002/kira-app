package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "credit_card_cashback_rules",
        indexes = @Index(name = "idx_cc_rule_user_card_active", columnList = "user_id,credit_card_id,active"),
        uniqueConstraints = @UniqueConstraint(name = "uk_cc_rule_start",
                columnNames = {"credit_card_id", "mcc_category_id", "effective_from"}))
@Getter
@Setter
@NoArgsConstructor
public class CreditCardCashbackRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cashback_rule_id")
    private Long cashbackRuleId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "credit_card_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private CreditCard creditCard;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "mcc_category_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private CreditCardMccCategory mccCategory;

    @Column(name = "cashback_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal cashbackRate = BigDecimal.ZERO;

    @Column(name = "monthly_cap_amount", precision = 15, scale = 2)
    private BigDecimal monthlyCapAmount;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}

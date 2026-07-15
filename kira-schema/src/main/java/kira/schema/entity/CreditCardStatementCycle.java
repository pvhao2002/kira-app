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
@Table(name = "credit_card_statement_cycles",
        indexes = {
                @Index(name = "idx_cc_statement_user_due", columnList = "user_id,due_date"),
                @Index(name = "idx_cc_statement_card_month", columnList = "credit_card_id,cycle_month")
        },
        uniqueConstraints = @UniqueConstraint(name = "uk_cc_statement_cycle",
                columnNames = {"user_id", "credit_card_id", "cycle_month"}))
@Getter
@Setter
@NoArgsConstructor
public class CreditCardStatementCycle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "statement_cycle_id")
    private Long statementCycleId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "credit_card_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private CreditCard creditCard;

    @Column(name = "cycle_month", nullable = false)
    private LocalDate cycleMonth;

    @Column(name = "statement_date", nullable = false)
    private LocalDate statementDate;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "statement_amount", precision = 15, scale = 2)
    private BigDecimal statementAmount;

    @Column(name = "statement_issued_at")
    private LocalDateTime statementIssuedAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}

package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "credit_cards", indexes = @Index(name = "idx_credit_cards_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class CreditCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "credit_card_id")
    private Long creditCardId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "bank_name", nullable = false, length = 128)
    private String bankName;

    @Column(name = "card_label", nullable = false, length = 256)
    private String cardLabel;

    @Column(name = "last_four", length = 4)
    private String lastFour;

    @Column(name = "credit_limit", nullable = false, precision = 15, scale = 2)
    private BigDecimal creditLimit = BigDecimal.ZERO;

    @Column(name = "outstanding_balance", nullable = false, precision = 15, scale = 2)
    private BigDecimal outstandingBalance = BigDecimal.ZERO;

    @Column(name = "cardholder_name", nullable = false, length = 128)
    private String cardholderName;

    @Column(name = "statement_day", nullable = false)
    private Integer statementDay;

    @Column(name = "payment_due_day", nullable = false)
    private Integer paymentDueDay;

    @Column(name = "reminder_time", nullable = false)
    private LocalTime reminderTime;

    @Column(name = "cycle_statement_done", nullable = false)
    private Boolean cycleStatementDone = false;

    @Column(name = "cycle_due_paid", nullable = false)
    private Boolean cycleDuePaid = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

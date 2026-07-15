package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import kira.schema.entity.enums.CashbackTransactionStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "credit_card_cashback_transactions", indexes = {
        @Index(name = "idx_cc_tx_user_status_due", columnList = "user_id,status,cashback_due_date"),
        @Index(name = "idx_cc_tx_card_date", columnList = "credit_card_id,transaction_date")
})
@Getter
@Setter
@NoArgsConstructor
public class CreditCardCashbackTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "transaction_id")
    private Long transactionId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "credit_card_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private CreditCard creditCard;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mcc_category_id", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private CreditCardMccCategory mccCategory;

    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    @Column(name = "customer_name", length = 160)
    private String customerName;

    @Column(name = "bill_reference", length = 160)
    private String billReference;

    @Column(length = 512)
    private String description;

    @Column(name = "spend_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal spendAmount;

    @Column(name = "discount_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal discountRate;

    @Column(name = "discount_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "cashback_rate_snapshot", nullable = false, precision = 5, scale = 2)
    private BigDecimal cashbackRateSnapshot;

    @Column(name = "monthly_cap_snapshot", precision = 15, scale = 2)
    private BigDecimal monthlyCapSnapshot;

    @Column(name = "expected_cashback_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal expectedCashbackAmount;

    @Column(name = "actual_cashback_amount", precision = 15, scale = 2)
    private BigDecimal actualCashbackAmount;

    @Column(name = "cashback_due_date")
    private LocalDate cashbackDueDate;

    @Column(name = "cashback_received_at")
    private LocalDate cashbackReceivedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CashbackTransactionStatus status = CashbackTransactionStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}

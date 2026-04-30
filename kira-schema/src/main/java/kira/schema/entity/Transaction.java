package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import kira.schema.entity.enums.TransactionSource;
import kira.schema.entity.enums.TransactionStatus;
import kira.schema.entity.enums.TransactionType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "transaction_id")
    private Long transactionId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "enum('withdraw','deposit','bonus')")
    private TransactionType type;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(name = "transaction_at", nullable = false)
    private LocalDateTime transactionAt;

    @Lob
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "enum('manual','ai') not null default 'manual'")
    private TransactionSource source = TransactionSource.manual;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "enum('success','processing','failed') not null default 'success'")
    private TransactionStatus status = TransactionStatus.success;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
